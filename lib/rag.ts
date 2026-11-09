/**
 * ファイルの用途: OpenAI Embeddings APIを使ったRAG検索と、LLMレビューの一連の処理。
 * 主な処理: 全チャンクのEmbeddingをバッチ生成→類似度検索→LLMへ根拠を渡す。
 * 補足: pgvectorはまだ使用せずメモリ上で検索。API通信失敗時は比較完了にしない。
 */
import OpenAI from "openai";
import { requireAiConfiguration } from "./ai-guard.ts";
import { makeChunks, rankEvidence } from "./rag-core.ts";
import { reviewWithLlm } from "./llm.ts";
import type { AiReview, Difference, Evidence, Mode, Report } from "./types.ts";

/** OpenAI Embedding APIの応答をインデックス順に検証して取り出す。 */
async function embed(client: OpenAI, input: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    input,
  });
  const sorted = [...response.data].sort((a, b) => a.index - b.index);
  if (sorted.length !== input.length || sorted.some((item, index) =>
    item.index !== index || !Array.isArray(item.embedding) || !item.embedding.length)) {
    throw new Error("Embeddingの応答数・インデックスが不正です。");
  }
  return sorted.map((item) => item.embedding);
}

/** 1回の送信サイズを抑えながらPDF全チャンクをベクトル化する。 */
async function semanticRetrieve(client: OpenAI, query: string, chunks: Evidence[]): Promise<Evidence[]> {
  if (!chunks.some((x) => x.document === "source") || !chunks.some((x) => x.document === "target")) {
    throw new Error("正本と比較対象の双方から検索用テキストを取得できませんでした。");
  }
  const queryVector = (await embed(client, [query]))[0];
  const vectors: number[][] = [];
  // 多数のチャンクは少量ずつ送る。全件を扱い、先頭50件で切り捨てない。
  for (let i = 0; i < chunks.length; i += 48) {
    const batch = chunks.slice(i, i + 48);
    vectors.push(...await embed(client, batch.map((item) => item.text)));
  }
  return rankEvidence(queryVector, chunks, vectors, 5);
}

/** 厳密比較の候補から関連箇所を探し、根拠付きのLLMレビューを取得する。 */
export async function reviewWithRag(
  source: Report, target: Report, differences: Difference[], mode: Mode,
): Promise<AiReview> {
  requireAiConfiguration(process.env.OPENAI_API_KEY);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
  const candidates = differences.filter((item) => item.status !== "match" && item.status !== "missing");
  const query = [
    "月次作業報告書の比較。記載内容・作業時間・作業日数・作業項目に関する差異と省略。",
    ...candidates.slice(0, 12).map((item) => `${item.title}: 正本=${item.sourceValue ?? "無"}, 対象=${item.targetValue ?? "無"}`),
  ].join("\n").slice(0, 2200);
  const chunks = [...makeChunks(source, "source"), ...makeChunks(target, "target")];
  const evidence = await semanticRetrieve(client, query, chunks);
  return reviewWithLlm(client, mode, candidates, evidence);
}
