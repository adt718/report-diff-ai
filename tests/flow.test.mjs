/**
 * ファイルの用途: 厳密差分と必須AI/RAGの統合フローをモックで確認する結合テスト。
 * 主な処理: AIが成功した場合だけJSONが組み立てられ、AI失敗時は成功しないことを検証する。
 * 補足: Next.js HTTP経由の検証はtest:smokeで別途実施する。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { extractFields } from "../lib/compare.ts";
import { compareParsedReports } from "../lib/compare-flow.ts";

const report = (name, text) => {
  const pages = [{ page: 1, text }];
  return { fileName: name, pageCount: 1, pages, fields: extractFields(pages) };
};
const source = report("source.pdf", "稼働時間：160時間\nAPI設計レビュー実施");
const target = report("target.pdf", "稼働時間：152時間\nAPIレビュー実施");

test("AI/RAGモック成功時は厳密差分・根拠を同時返却", async () => {
  const result = await compareParsedReports(source, target, "same-month", async (_source, _target, differences) => {
    assert.equal(differences.find((d) => d.field === "workingHours").severity, "critical");
    return { overview: "8時間の不一致", findings: [], evidence: [
      { id: "S-p1-1", document: "source", page: 1, text: "160時間" },
      { id: "T-p1-1", document: "target", page: 1, text: "152時間" },
    ] };
  });
  assert.equal(result.summary.mismatches, 1);
  assert.equal(result.aiReview.evidence.length, 2);
});

test("必須AI処理が例外を投げたら比較成功を返さない", async () => {
  await assert.rejects(() => compareParsedReports(source, target, "same-month", async () => {
    throw new Error("AI接続失敗");
  }), /AI接続失敗/);
});

test("必須AI結果が空なら成功扱いにしない", async () => {
  await assert.rejects(() => compareParsedReports(source, target, "same-month", async () => ({})), /不完全/);
});
