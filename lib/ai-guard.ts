/**
 * ファイルの用途: 必須AI分析の設定・出力検証を担当する安全確認モジュール。
 * 主な処理: OpenAI APIキーの未設定を検出し、AI回答の形式・根拠IDなどを検証する。
 * 補足: 根拠が不正な結果を正式な比較成功として扱わない。
 */

import type { AiReview, Evidence, Severity } from "./types.ts";

/**
 * AI + RAGは必須。APIキーを設定しないまま「比較成功」にはしない。
 * 空白だけの設定も未設定として扱い、比較前にサーバーで確認する。
 */
export function requireAiConfiguration(apiKey: string | undefined): void {
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEYが未設定です。.env.localへAPIキーを設定してください。AI + RAGは必須です。");
  }
}

/**
 * LLMの回答がJSON Schemaに従っていても、説明の根拠IDが正しいとは限らない。
 * 型と出典を再検査し、不完全な回答は比較完了として扱わない。
 */
export function validateAiReview(outputText: string, evidence: Evidence[]): AiReview {
  if (!evidence.some((item) => item.document === "source") ||
      !evidence.some((item) => item.document === "target")) {
    throw new Error("RAGで正本・比較対象の両方の根拠を取得できませんでした。");
  }
  let value: unknown;
  try {
    value = JSON.parse(outputText);
  } catch {
    throw new Error("LLMから正しいJSONの分析結果を受信できませんでした。");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("LLMの回答形式が不正です。");
  }
  const result = value as Record<string, unknown>;
  if (typeof result.overview !== "string" || !result.overview.trim() ||
      !Array.isArray(result.findings)) {
    throw new Error("LLMの分析結果に概要または指摘一覧がありません。");
  }

  const validIds = new Set(evidence.map((item) => item.id));
  const severities: Severity[] = ["critical", "warning", "info"];
  const findings: AiReview["findings"] = [];
  for (const finding of result.findings) {
    if (typeof finding !== "object" || finding === null || Array.isArray(finding)) {
      throw new Error("LLMの指摘データが不正です。");
    }
    const item = finding as Record<string, unknown>;
    if (typeof item.severity !== "string" || !severities.includes(item.severity as Severity) ||
        typeof item.title !== "string" || !item.title.trim() ||
        typeof item.explanation !== "string" || !item.explanation.trim() ||
        !Array.isArray(item.evidenceIds) || item.evidenceIds.length === 0 ||
        !item.evidenceIds.every((id) => typeof id === "string" && validIds.has(id))) {
      throw new Error("LLMの指摘に不正な値、または存在しない根拠IDがあります。");
    }
    findings.push({
      severity: item.severity as Severity,
      title: item.title.slice(0, 100),
      explanation: item.explanation.slice(0, 800),
      evidenceIds: Array.from(new Set(item.evidenceIds as string[])),
    });
  }

  // findingsが0件でも、RAG検索とLLMが正常完了していれば問題ない。
  return { overview: result.overview.slice(0, 1000), findings: findings.slice(0, 8), evidence };
}
