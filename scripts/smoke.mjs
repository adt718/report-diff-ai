/**
 * ファイルの用途: 起動中のNext.js APIへサンプルPDFを送信する実通信スモークテスト。
 * 主な処理: HTTP 200・重要な差分・LLM/RAGの根拠を確認する。
 * 補足: OPENAI_API_KEY設定済みサーバーが必要。実APIの料金が発生する。
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const endpoint = new URL("/api/compare", process.env.SMOKE_BASE_URL || "http://localhost:3000");
const upload = async (name) => new File([await readFile(new URL(`../sample/${name}`, import.meta.url))], name, { type: "application/pdf" });
const form = new FormData();
form.set("source", await upload("report_source.pdf"));
form.set("target", await upload("report_target.pdf"));
form.set("mode", "same-month");

console.log(`POST ${endpoint} (OpenAI APIの実通信と費用が発生します)`);
const response = await fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(180_000) });
const body = await response.json();
if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.error || JSON.stringify(body)}`);
assert.ok(body.differences.some((d) => d.field === "workingHours" && d.severity === "critical"));
assert.ok(body.aiReview?.overview);
assert.ok(body.aiReview?.evidence?.some((e) => e.document === "source"));
assert.ok(body.aiReview?.evidence?.some((e) => e.document === "target"));
console.log("PASS: 数値差分＋LLM概要＋双方のPDF根拠を取得しました。");
