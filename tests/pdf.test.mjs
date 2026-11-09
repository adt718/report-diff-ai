/**
 * ファイルの用途: 実物のサンプルPDFをunpdfで読み込み、項目が抽出できるかを確認するテスト。
 * 主な処理: 正本160時間・比較対象152時間をPDFファイルから検出する。
 * 補足: npm install後にnpm run test:pdfで実行する（外部API不要）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePdf } from "../lib/pdf.ts";

async function file(name) {
  const bytes = await readFile(new URL(`../sample/${name}`, import.meta.url));
  return new File([bytes], name, { type: "application/pdf" });
}

test("実物PDFを解析し、稼働時間160時間と152時間を取り出せる", async () => {
  const [a, b] = await Promise.all([
    parsePdf(await file("report_source.pdf")),
    parsePdf(await file("report_target.pdf")),
  ]);
  assert.ok(a.pageCount > 0 && b.pageCount > 0);
  assert.match(a.fields.workingHours?.value ?? "", /160/);
  assert.match(b.fields.workingHours?.value ?? "", /152/);
});
