/**
 * ファイルの用途: 必須AI分析の入力設定と結果の検証を確認するテスト。
 * 主な処理: APIキー未設定、根拠IDの不整合、AI応答の形式エラーを検出できるか検証する。
 * 補足: 外部OpenAI APIへは接続しない単体テスト。
 */

import test from "node:test";
import assert from "node:assert/strict";
import { requireAiConfiguration, validateAiReview } from "../lib/ai-guard.ts";

const evidence = [
  { id: "S-p1-1", document: "source", page: 1, text: "稼働時間：160時間" },
  { id: "T-p1-1", document: "target", page: 1, text: "稼働時間：152時間" },
];

test("AI + RAG必須: APIキーの未設定・空白はエラーにする", () => {
  assert.throws(() => requireAiConfiguration(undefined), /未設定/);
  assert.throws(() => requireAiConfiguration("  "), /未設定/);
  assert.doesNotThrow(() => requireAiConfiguration("sk-test"));
});

test("AI + RAG必須: 有効な根拠を持つ分析だけ成功", () => {
  const response = { overview: "稼働時間が異なります。", findings: [
    { severity: "critical", title: "稼働時間", explanation: "160時間と152時間", evidenceIds: ["S-p1-1", "T-p1-1"] },
  ] };
  const result = validateAiReview(JSON.stringify(response), evidence);
  assert.equal(result.findings[0].evidenceIds.length, 2);
  assert.equal(result.evidence.length, 2);
});

test("AI + RAG必須: JSON不正や空のLLM応答で完了扱いにしない", () => {
  assert.throws(() => validateAiReview("not-json", evidence), /JSON/);
  assert.throws(() => validateAiReview('{}', evidence), /分析結果/);
});

test("AI + RAG必須: 根拠の無い指摘で完了扱いにしない", () => {
  assert.throws(() => validateAiReview(JSON.stringify({ overview: "確認", findings: [
    { severity: "warning", title: "作業内容", explanation: "要確認", evidenceIds: ["fake-id"] },
  ] }), evidence), /根拠ID/);
});

test("AI + RAG必須: 正本側しか根拠が無い場合は失敗", () => {
  assert.throws(() => validateAiReview('{"overview":"問題なし","findings":[]}', evidence.slice(0, 1)), /両方/);
});

test("AI + RAG必須: 指摘0件は正常な分析結果として扱う", () => {
  const result = validateAiReview('{"overview":"追加指摘なし","findings":[]}', evidence);
  assert.equal(result.findings.length, 0);
});
