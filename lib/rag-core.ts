/**
 * ファイルの用途: RAGのテキスト分割・ベクトル類似度計算・根拠検索を行う純粋関数。
 * 主な処理: PDFのページ情報を保持してチャンクに分割し、正本と比較対象を独立にランキングする。
 * 補足: 外部APIへ接続しないので単体テスト可能。全文を黙って切り捨てない。
 */
import type { Evidence, Report } from "./types.ts";

export const CHUNK_SIZE = 700;
export const MAX_CHUNKS_PER_DOCUMENT = 400;

/** 長い1行も欠落させずに分割する。各チャンクにはPDFの元ページを付ける。 */
export function makeChunks(report: Report, document: Evidence["document"]): Evidence[] {
  const result: Evidence[] = [];
  const prefix = document === "source" ? "S" : "T";
  for (const page of report.pages) {
    const lines = page.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let buffer = "";
    let part = 0;
    const flush = () => {
      if (!buffer.trim()) return;
      result.push({ id: `${prefix}-p${page.page}-${++part}`, document, page: page.page, text: buffer.trim() });
      buffer = "";
    };
    for (const line of lines) {
      // 700文字を超える長い行についても全体を保存する。
      let rest = line;
      while (rest.length > 0) {
        const available = CHUNK_SIZE - buffer.length;
        if (available <= 0) { flush(); continue; }
        const fragment = rest.slice(0, available);
        buffer += fragment;
        rest = rest.slice(fragment.length);
        if (buffer.length === CHUNK_SIZE) flush();
        else if (rest.length === 0) {
          // 改行も容量として数え、元の行の境目を残す。
          buffer += "\n";
        }
      }
    }
    flush();
  }
  // 取得範囲が大き過ぎる場合は、未検索の部分を黙って落とさず明示的に中断。
  if (result.length > MAX_CHUNKS_PER_DOCUMENT) {
    throw new Error(`${document === "source" ? "正本" : "比較対象"}PDFのチャンク数が上限(${MAX_CHUNKS_PER_DOCUMENT})を超えました。`);
  }
  return result;
}

/** 異なる次元や空ベクトルを許容すると誤った検索になるので失敗させる。 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length || a.some((v) => !Number.isFinite(v)) || b.some((v) => !Number.isFinite(v))) {
    throw new Error("Embeddingベクトルの次元または値が不正です。");
  }
  let dot = 0, left = 0, right = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    left += a[i] ** 2;
    right += b[i] ** 2;
  }
  if (left === 0 || right === 0) throw new Error("Embeddingベクトルがゼロです。");
  return dot / Math.sqrt(left * right);
}

/** 両方のPDFからそれぞれ上位を選び、片側の根拠だけに偏らないようにする。 */
export function rankEvidence(
  queryVector: number[], chunks: Evidence[], vectors: number[][], perDocument = 5,
): Evidence[] {
  if (chunks.length !== vectors.length) throw new Error("Embeddingとチャンク数が一致しません。");
  const scored = chunks.map((chunk, index) => ({ chunk, score: cosineSimilarity(queryVector, vectors[index]) }));
  return (["source", "target"] as const).flatMap((document) =>
    scored.filter((item) => item.chunk.document === document)
      .sort((a, b) => b.score - a.score).slice(0, perDocument).map((item) => item.chunk));
}
