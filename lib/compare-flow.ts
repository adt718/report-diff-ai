/**
 * ファイルの用途: PDF解析後の「厳密比較→必須AI/RAGレビュー→応答生成」を組み立てる。
 * 主な処理: 依存するAI処理を注入できるようにして、APIキーなしの結合テストを可能にする。
 * 補足: 実際のAPIではreviewWithRagを渡す。AI失敗時は結果を返さず例外を伝播する。
 */
import { compareReports } from "./compare.ts";
import type { AiReview, CompareResponse, Difference, Mode, Report } from "./types.ts";

type Analyzer = (source: Report, target: Report, differences: Difference[], mode: Mode) => Promise<AiReview>;

export async function compareParsedReports(
  source: Report, target: Report, mode: Mode, analyze: Analyzer,
): Promise<CompareResponse> {
  const { differences, summary } = compareReports(source, target, mode);
  const warnings = [
    "テキスト抽出可能なPDFのみ対応しています。スキャン・画像・複雑な表レイアウトは未対応です。",
    "一致は解析できた項目・テキストについての結果であり、PDF全体の完全一致を保証しません。",
    "RAGは意味的な関連箇所を検索する方式です。未検索の重要箇所が残る可能性があります。",
  ];
  if (mode === "cross-month") warnings.push("異なる月の値の変化は自動的に誤記とみなしていません。");
  if (summary.hasLimitations) warnings.push("未抽出項目や本文の表示上限があります。原本を確認してください。");

  // テスト時だけモックを注入しても、本番では必須の分析を省略できない。
  const aiReview = await analyze(source, target, differences, mode);
  if (!aiReview?.overview || !Array.isArray(aiReview.evidence) || !Array.isArray(aiReview.findings)) {
    throw new Error("LLM・RAGの分析結果が不完全です。");
  }
  return {
    mode,
    source: { fileName: source.fileName, pageCount: source.pageCount, fields: source.fields },
    target: { fileName: target.fileName, pageCount: target.pageCount, fields: target.fields },
    differences, summary, warnings, aiReview,
  };
}
