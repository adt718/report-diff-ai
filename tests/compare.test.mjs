/**
 * ファイルの用途: PDFから抽出した値の厳密比較ロジックを検証するテスト。
 * 主な処理: 表記揺れ・稼働時間の不一致・同月/異月の扱いなどを確認する。
 * 補足: 実際のPDFアップロードではなく、擬似Reportデータを使用する。
 */

import test from "node:test";
import assert from "node:assert/strict";
import { extractFields, compareReports } from "../lib/compare.ts";

/** テスト用に、PDF解析済みのReportと同じ構造を1ページ分だけ生成する。 */
const makeReport = (name, text) => {
  const pages = [{ page: 1, text }];
  return { fileName: name, pageCount: 1, pages, fields: extractFields(pages) };
};

// テスト1: 表記揺れがあっても数値・年月を一致として扱う。
test("全角数字・単位違いを同じ数値として比較できる", () => {
  const source = makeReport("a.pdf", "対象年月：2026年10月\n氏名：田中太郎\n稼働時間：１６０時間\n作業日数：２０日\n開発作業");
  const target = makeReport("b.pdf", "対象年月：2026/10\n氏名：田中太郎\n稼働時間：160h\n作業日数：20日\n開発作業");
  const { differences } = compareReports(source, target, "same-month");
  assert.equal(differences.find((item) => item.field === "workingHours")?.status, "match");
  assert.equal(differences.find((item) => item.field === "workingDays")?.status, "match");
  assert.equal(differences.find((item) => item.field === "period")?.status, "match");
});

// テスト2: 同月の稼働時間の違いは重要な不一致として扱う。
test("同月で稼働時間が違えば重要な不一致", () => {
  const source = makeReport("a.pdf", "稼働時間: 160h\n担当：APIテスト");
  const target = makeReport("b.pdf", "稼働時間: 152h\n担当：APIテスト");
  const { differences } = compareReports(source, target, "same-month");
  const diff = differences.find((item) => item.field === "workingHours");
  assert.equal(diff?.status, "changed");
  assert.equal(diff?.severity, "critical");
});

// テスト3: 異なる月の稼働時間の変化は、誤記と自動判定しない。
test("異なる月の稼働時間の変更を誤りと判定しない", () => {
  const source = makeReport("a.pdf", "対象年月: 2026年10月\n稼働時間: 160h");
  const target = makeReport("b.pdf", "対象年月: 2026年11月\n稼働時間: 152h");
  const result = compareReports(source, target, "cross-month");
  assert.equal(result.summary.mismatches, 0);
  assert.equal(result.differences.find((item) => item.field === "workingHours")?.severity, "info");
});

// テスト4: 本文の書き換えは2行分の差分として表示し、根拠ページを保持する。
test("本文の記載漏れは元のページ番号と共に差分出力", () => {
  const source = makeReport("a.pdf", "稼働時間: 160h\n設計レビューを実施");
  const target = makeReport("b.pdf", "稼働時間: 160h\n単体テストを実施");
  const result = compareReports(source, target, "same-month");
  assert.equal(result.summary.totalTextDifferences, 2);
  assert.ok(result.differences.some((item) => item.category === "text" && item.sourcePage === 1));
  assert.ok(result.differences.some((item) => item.category === "text" && item.targetPage === 1));
});

// テスト5: 同一行の繰り返し回数の違いも検出する。
test("重複行は出現回数の差だけ検出する", () => {
  const source = makeReport("a.pdf", "稼働時間: 160h\nAPIテストを実施\nAPIテストを実施");
  const target = makeReport("b.pdf", "稼働時間: 160h\nAPIテストを実施");
  const result = compareReports(source, target, "same-month");
  assert.equal(result.summary.totalTextDifferences, 1);
  assert.equal(result.differences.filter((item) => item.category === "text").length, 1);
});

// テスト6: 項目の行や本文行を並べ替えても差分としない。
test("本文の行順変更だけなら差分としない", () => {
  const source = makeReport("a.pdf", "稼働時間: 160h\n設計を実施\nテストを実施");
  const target = makeReport("b.pdf", "稼働時間: 160h\nテストを実施\n設計を実施");
  assert.equal(compareReports(source, target, "same-month").summary.totalTextDifferences, 0);
});
