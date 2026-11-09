/**
 * ファイルの用途: PDF比較APIの受付窓口。
 * 主な処理: 2つのPDFの受信・形式確認・文字抽出・厳密比較を実行し、必須のRAG/LLM分析を呼び出す。
 * 補足: AI処理が失敗した場合は比較完了とせず、HTTPエラーを返す。
 */

import { NextRequest, NextResponse } from "next/server";
import { compareParsedReports } from "../../../lib/compare-flow.ts";
import { parsePdf } from "../../../lib/pdf.ts";
import { reviewWithRag } from "../../../lib/rag.ts";
import type { Mode } from "../../../lib/types.ts";
import { requireAiConfiguration } from "../../../lib/ai-guard.ts";

// PDF解析とOpenAI SDKはNode.js用のため、Edge RuntimeではなくNode.jsを指定する。
export const runtime = "nodejs";
export const maxDuration = 180; // 多数のチャンクをバッチEmbeddingするため実行時間に余裕を持たせる（配備先の制限に注意）

/**
 * POST /api/compare
 * Content-Type: multipart/form-data
 * 必須フィールド: source(正本PDF), target(比較対象PDF)
 * 任意フィールド: mode(same-month/cross-month)
 * AI + RAGはサーバー側で必須（enableAIフラグは使用しない）。
 *
 * このMVPではファイルをサーバーに永続保存せず、リクエスト内で解析して返す。
 */
export async function POST(request: NextRequest) {
  // 設定不足ならPDFを解析・APIへ送信する前に失敗する。
  try {
    requireAiConfiguration(process.env.OPENAI_API_KEY);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AIの設定が必要です。" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    // ① multipart/form-dataを受信する。
    const form = await request.formData();
    const sourceFile = form.get("source");
    const targetFile = form.get("target");
    const mode: Mode = form.get("mode") === "cross-month" ? "cross-month" : "same-month";

    if (!(sourceFile instanceof File) || !(targetFile instanceof File)) {
      return NextResponse.json(
        { error: "正本PDFと比較対象PDFを選択してください。" },
        { status: 400 },
      );
    }

    // ② 正本と対象PDFを解析し、各ページの文字列・代表項目を取得する。
    // 同時に処理するが、運用時は認証・サイズ制限・レート制限を前段でも行う。
    const [source, target] = await Promise.all([
      parsePdf(sourceFile),
      parsePdf(targetFile),
    ]);

    // ③ 決定論的な差分比較→必須RAG→必須LLMを実行する。
    // 実装はcompare-flow.tsに分離し、モックを使った結合テストを可能にする。
    let result;
    try {
      result = await compareParsedReports(source, target, mode, reviewWithRag);
    } catch (error) {
      console.error("AI + RAG comparison failed:", error);
      return NextResponse.json(
        { error: "AI + RAG分析に失敗しました。比較は未完了です。API設定・接続・モデル権限を確認してください。" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    // PDFファイル自体を保存・返却しない。JSONだけを画面へ返す。
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 初期MVPでは入力・解析エラーを400として返す。運用時は詳細な例外分類を推奨。
    const message = error instanceof Error ? error.message : "PDFの読み取りに失敗しました。";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
