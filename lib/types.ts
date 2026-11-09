/**
 * ファイルの用途: API・画面・PDF解析・比較処理で共通使用するTypeScript型定義。
 * 主な処理: Report、Difference、Evidence、AiReviewなどのデータ構造と比較モードを統一する。
 * 補足: sourceは正本PDF、targetは比較対象PDFを意味する。
 */

/**
 * API・画面・比較ロジックで共有する型定義。
 *
 * データの流れ：
 * File(PDF) → Report(抽出結果) → Difference[] → CompareResponse(API応答)
 *
 * 「PDFが正本」であるため、source は必ず正本、target は比較対象を表す。
 */

/** 同月比較と、別の月との推移比較は判定基準が異なる。 */
export type Mode = "same-month" | "cross-month";

/** PDFから取り出す代表的な6項目。帳票に応じて増やせる。 */
export type FieldKey =
  | "period"
  | "reporter"
  | "project"
  | "workingDays"
  | "workingHours"
  | "overtimeHours";

/** 差分の種類。片方だけに存在するときは source-only / target-only を使う。 */
export type Status = "match" | "changed" | "source-only" | "target-only" | "missing";

/** 重要度。画面の色分けと集計に利用する。 */
export type Severity = "critical" | "warning" | "info";

/** ページ番号はPDFと同じ1始まりで保持する。 */
export type PdfPageText = { page: number; text: string };

/** どのページ・原文から項目を抽出したかを失わないようにする。 */
export type ExtractedField = {
  value: string;
  page: number;
  originalLine: string;
};

/** 値が検出されなかった場合はnull。未検出と空文字は区別する。 */
export type Fields = Record<FieldKey, ExtractedField | null>;

/** PDF解析直後のデータ。本文は比較とRAGで使用する。 */
export type Report = {
  fileName: string;
  pageCount: number;
  pages: PdfPageText[];
  fields: Fields;
};

/** 正本と比較対象の差異を1件ずつ表現する。 */
export type Difference = {
  id: string;
  category: "field" | "text";
  field?: FieldKey;
  title: string;
  status: Status;
  severity: Severity;
  sourceValue: string | null;
  targetValue: string | null;
  sourcePage: number | null;
  targetPage: number | null;
};

/** 画面上部の比較結果サマリー。 */
export type Summary = {
  matches: number;
  mismatches: number;
  needsReview: number;
  comparedFields: number;
  totalTextDifferences: number;
  hasLimitations: boolean;
};

/** LLMに提示する根拠の単位。IDを介して元のPDFページへ戻れる。 */
export type Evidence = {
  id: string;
  document: "source" | "target";
  page: number;
  text: string;
};

/** AIは比較処理の必須段階。ただし数値照合の結果は上書きしない。 */
export type AiFinding = {
  severity: Severity;
  title: string;
  explanation: string;
  evidenceIds: string[];
};
export type AiReview = {
  overview: string;
  findings: AiFinding[];
  evidence: Evidence[];
};

/** POST /api/compare の成功レスポンス。PDF本文そのものは返却しない。 */
export type CompareResponse = {
  mode: Mode;
  source: Pick<Report, "fileName" | "pageCount" | "fields">;
  target: Pick<Report, "fileName" | "pageCount" | "fields">;
  differences: Difference[];
  summary: Summary;
  warnings: string[];
  aiReview: AiReview; // 比較成功の場合は必ず存在する
};
