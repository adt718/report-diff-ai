/**
 * ファイルの用途: RAGのチャンク生成・ページ番号・類似度・両PDFからの検索を検証する。
 * 主な処理: 長文が切り捨てられないこと、重要な出典が残ることを外部APIなしでテストする。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { makeChunks, cosineSimilarity, rankEvidence, CHUNK_SIZE } from "../lib/rag-core.ts";

function report(text) { return { fileName: "x.pdf", pageCount: 1, pages: [{ page: 1, text }] }; }

test("長い1行も欠落させずに全チャンクへ分割できる", () => {
  const content = "A".repeat(CHUNK_SIZE * 2 + 150);
  const chunks = makeChunks(report(content), "source");
  assert.equal(chunks.length, 3);
  assert.equal(chunks.map((c) => c.text).join(""), content);
  assert.ok(chunks.every((c) => c.page === 1 && c.id.startsWith("S-p1-")));
});

test("チャンク上限を超えた場合は内容を無視せずエラーにする", () => {
  assert.throws(() => makeChunks(report("A".repeat(700 * 401)), "source"), /上限/);
});

test("コサイン類似度は同方向で1、異なる方向で0", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.throws(() => cosineSimilarity([1, 0], [1]), /次元/);
});

test("両方のPDFから根拠を選び片側だけにならない", () => {
  const chunks = [
    { id: "S1", document: "source", page: 1, text: "設計" },
    { id: "S2", document: "source", page: 2, text: "実装" },
    { id: "T1", document: "target", page: 1, text: "設計" },
    { id: "T2", document: "target", page: 2, text: "実装" },
  ];
  const ranked = rankEvidence([1, 0], chunks, [[0, 1], [1, 0], [1, 0], [0, 1]], 1);
  assert.deepEqual(ranked.map((c) => c.id), ["S2", "T1"]);
});
