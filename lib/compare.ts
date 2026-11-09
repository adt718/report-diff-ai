/**
 * ファイルの用途: 作業報告書の決定論的（プログラムによる）差分比較ロジック。
 * 主な処理: PDFの抽出文字列から稼働時間・日付・作業者などを取り出し、正規化・照合する。
 * 補足: LLMの推測には依存せず、数値と記載内容の差分候補を生成する。
 */

import type {
  Difference,
  ExtractedField,
  FieldKey,
  Fields,
  Mode,
  PdfPageText,
  Report,
  Summary,
} from "./types.ts";

/** UIでの項目名。キーとラベルを一か所で管理する。 */
export const FIELD_LABELS: Record<FieldKey, string> = {
  period: "対象年月",
  reporter: "作業者名",
  project: "案件・プロジェクト名",
  workingDays: "作業日数",
  workingHours: "稼働時間",
  overtimeHours: "残業時間",
};

/**
 * 実際の帳票で想定される見出しの表記揺れ。
 *
 * 例えば「実働時間」と「稼働時間」は同じ workingHours として抽出する。
 * 実物PDFの見出しに合わせて追加・編集する拡張ポイント。
 */
const FIELD_ALIASES: Record<FieldKey, string[]> = {
  period: ["作業対象年月", "対象年月", "報告年月", "報告月", "作業年月"],
  reporter: ["作業者氏名", "報告者氏名", "作業者名", "報告者", "氏名"],
  project: ["プロジェクト名", "作業案件名", "案件名", "業務名"],
  workingDays: ["稼働日数", "作業日数", "勤務日数", "出勤日数"],
  workingHours: ["合計稼働時間", "総稼働時間", "総作業時間", "実働時間", "稼働時間", "作業時間", "勤務時間", "合計時間"],
  overtimeHours: ["時間外労働時間", "時間外勤務時間", "時間外労働", "時間外勤務", "残業時間", "時間外時間"],
};

const keys = Object.keys(FIELD_LABELS) as FieldKey[];

/** 正規表現として意味を持つ文字が見出しに含まれても安全に処理する。 */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 全角・半角や余分な空白の表記揺れを吸収する。
 * NFKCで「１６０」→「160」などに統一する。
 */
export const normalizeLine = (value: string): string =>
  value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();

/**
 * PDFの各行から代表項目を抽出する。
 *
 * 見出しが行頭にある「稼働時間：160時間」のような形式を想定。
 * 複雑な表・1行に複数項目が並ぶ帳票は、専用パーサーが必要。
 */
export function extractFields(pages: PdfPageText[]): Fields {
  const fields = Object.fromEntries(keys.map((key) => [key, null])) as Fields;

  // 見出しが長いものを先に判定し、部分一致による誤抽出を減らす。
  const patterns = Object.fromEntries(
    keys.map((key) => {
      const aliases = [...FIELD_ALIASES[key]].sort((a, b) => b.length - a.length);
      return [
        key,
        new RegExp(`^\\s*(?:${aliases.map(escapeRegExp).join("|")})\\s*[:：=]?\\s*(.+?)\\s*$`, "i"),
      ];
    }),
  ) as Record<FieldKey, RegExp>;

  for (const page of pages) {
    for (const originalLine of page.text.split(/\r?\n/)) {
      const line = normalizeLine(originalLine);
      for (const key of keys) {
        if (fields[key]) continue; // 同じ項目が複数回登場したら初回を採用（MVPの仕様）

        const match = line.match(patterns[key]);
        if (!match?.[1]) continue;

        const value = match[1].trim();
        if (value && value.length <= 160) {
          fields[key] = { value, page: page.page, originalLine: originalLine.trim() };
        }
      }
    }
  }
  return fields;
}

/**
 * 比較用の値へ正規化する。表示は元の値を使い、比較だけこの関数を使用。
 * 例: "１６０時間" と "160h" → "160"
 * 例: "2026年10月" と "2026/10" → "2026-10"
 */
function canonicalValue(key: FieldKey, value: string): string {
  const clean = normalizeLine(value).replace(/[,_，]/g, "");
  if (key === "workingDays" || key === "workingHours" || key === "overtimeHours") {
    const numeric = clean.match(/^(-?\d+(?:\.\d+)?)\s*(?:時間|h|H|日|日間)?$/);
    if (numeric) return String(Number(numeric[1]));
  }
  if (key === "period") {
    const period = clean.match(/(\d{4})\s*[年\/.-]\s*(\d{1,2})\s*月?/);
    if (period) return `${period[1]}-${period[2].padStart(2, "0")}`;
  }
  return clean;
}

/**
 * 単一項目の比較。正本と対象の有無・値・比較モードで重要度を判断する。
 * 異月の場合、単に稼働時間が変わっただけではミスと断定しない。
 */
function fieldDifference(
  key: FieldKey,
  source: ExtractedField | null,
  target: ExtractedField | null,
  mode: Mode,
): Difference {
  const status = !source && !target ? "missing"
    : !source ? "target-only"
    : !target ? "source-only"
    : canonicalValue(key, source.value) === canonicalValue(key, target.value) ? "match" : "changed";

  const severity = status === "match" ? "info"
    : status === "missing" ? "warning"
    : mode === "cross-month" ? "info"
    : ["workingDays", "workingHours", "overtimeHours", "period", "reporter"].includes(key)
      ? "critical"
      : "warning";

  return {
    id: `field-${key}`,
    category: "field",
    field: key,
    title: FIELD_LABELS[key],
    status,
    severity,
    sourceValue: source?.value ?? null,
    targetValue: target?.value ?? null,
    sourcePage: source?.page ?? null,
    targetPage: target?.page ?? null,
  };
}

/** 代表項目の行は本文比較から除外し、二重に差分表示されるのを防ぐ。 */
function isFieldLine(line: string): boolean {
  return keys.some((key) => FIELD_ALIASES[key].some((name) =>
    new RegExp(`^${escapeRegExp(name)}\\s*[:：=]?\\s*.+$`, "i").test(line)));
}

type LineRef = { value: string; page: number };

/** ページ番号を残したまま、空行・極端に短い行・項目行を除外する。 */
function linesFrom(pages: PdfPageText[]): LineRef[] {
  const lines: LineRef[] = [];
  for (const page of pages) {
    for (const raw of page.text.split(/\r?\n/)) {
      const value = normalizeLine(raw);
      if (!value || value.length < 2 || isFieldLine(value)) continue;
      lines.push({ value, page: page.page });
    }
  }
  return lines;
}

/**
 * 本文の各行の「出現回数」を比較する（multiset / 多重集合方式）。
 *
 * 例えば同じ文言が正本に2回、対象に1回なら「正本のみ」を1件出す。
 * 並び順変更は差分としない一方、意味的な言い換えは別の行と判定する。
 * 画面表示は最大80件だが、総差分行数は省略せずカウントする。
 */
function compareLines(
  source: PdfPageText[],
  target: PdfPageText[],
  mode: Mode,
): { results: Difference[]; total: number } {
  const sourceLines = linesFrom(source);
  const targetLines = linesFrom(target);
  const sourceMap = new Map<string, LineRef[]>();
  const targetMap = new Map<string, LineRef[]>();

  for (const item of sourceLines) {
    sourceMap.set(item.value, [...(sourceMap.get(item.value) ?? []), item]);
  }
  for (const item of targetLines) {
    targetMap.set(item.value, [...(targetMap.get(item.value) ?? []), item]);
  }

  const changes: Difference[] = [];
  let total = 0;
  for (const value of new Set([...sourceMap.keys(), ...targetMap.keys()])) {
    const sourceOccurrences = sourceMap.get(value) ?? [];
    const targetOccurrences = targetMap.get(value) ?? [];
    const count = Math.abs(sourceOccurrences.length - targetOccurrences.length);
    total += count;

    if (changes.length >= 80 || count === 0) continue;

    const status = sourceOccurrences.length > targetOccurrences.length ? "source-only" : "target-only";
    for (
      let index = Math.min(sourceOccurrences.length, targetOccurrences.length);
      index < Math.max(sourceOccurrences.length, targetOccurrences.length) && changes.length < 80;
      index++
    ) {
      const line = status === "source-only" ? sourceOccurrences[index] : targetOccurrences[index];
      changes.push({
        id: `text-${changes.length}`,
        category: "text",
        title: "本文の記述差分",
        status,
        severity: mode === "same-month" ? "warning" : "info",
        sourceValue: status === "source-only" ? value : null,
        targetValue: status === "target-only" ? value : null,
        sourcePage: status === "source-only" ? line.page : null,
        targetPage: status === "target-only" ? line.page : null,
      });
    }
  }
  return { results: changes, total };
}

/** PDF2件の比較結果を、画面表示に適した差分一覧・件数にまとめる。 */
export function compareReports(source: Report, target: Report, mode: Mode) {
  const fieldDiffs = keys.map((key) =>
    fieldDifference(key, source.fields[key], target.fields[key], mode));
  const lineDiff = compareLines(source.pages, target.pages, mode);
  const differences = [...fieldDiffs, ...lineDiff.results];

  // 「一致」は代表項目の一致件数。PDF全体が完全一致した保証ではない。
  const summary: Summary = {
    matches: fieldDiffs.filter((item) => item.status === "match").length,
    mismatches: differences.filter((item) => item.severity === "critical" && item.status !== "match").length,
    needsReview: differences.filter((item) => item.severity === "warning" && item.status !== "match").length,
    comparedFields: fieldDiffs.filter((item) => item.status !== "missing").length,
    totalTextDifferences: lineDiff.total,
    hasLimitations: lineDiff.total > lineDiff.results.length || fieldDiffs.some((item) => item.status === "missing"),
  };

  return { differences, summary };
}
