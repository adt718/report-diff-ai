/**
 * ファイルの用途: アップロードされたPDFの解析モジュール。
 * 主な処理: 容量・ページ数・PDF形式を検証し、ページ番号を保持しながらテキストを抽出する。
 * 補足: 抽出結果を比較処理で扱いやすいReport形式に変換する。
 */

import { extractText, getDocumentProxy } from "unpdf";
import { extractFields } from "./compare.ts";
import type { Report } from "./types.ts";

// 初期MVPとしての受信上限。運用開始前に認証・レート制限も追加すること。
const MAX_BYTES = 10 * 1024 * 1024; // 1ファイルにつき10MB
const MAX_PAGES = 30;
const MAX_TEXT_CHARS = 200_000;

/**
 * アップロードされたPDFを読み込み、ページごとのテキストと代表項目を取得する。
 *
 * 処理順:
 *  1. ファイルサイズ・PDFヘッダーを検査
 *  2. unpdf（PDF.jsベース）でPDFを読み込む
 *  3. ページ単位の文字列を抽出
 *  4. 「稼働時間: 160h」等の行を構造化する
 *
 * 注意: スキャン画像のみのPDFは文字が取れないためOCRが別途必要。
 */
export async function parsePdf(file: File): Promise<Report> {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error(`${file.name}: PDFは10MB以下にしてください。`);
  }

  // ファイル名や拡張子だけでは判定できないため、ファイル先頭の「%PDF-」を確認。
  // 厳密な安全性検査（マルウェアスキャン等）を代替するものではない。
  const bytes = new Uint8Array(await file.arrayBuffer());
  const magic = new TextDecoder("ascii").decode(bytes.subarray(0, 5));
  if (magic !== "%PDF-") {
    throw new Error(`${file.name}: 正しいPDFファイルではありません。`);
  }

  const document = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
  try {
    if (document.numPages > MAX_PAGES) {
      throw new Error(`${file.name}: 30ページを超えるPDFは未対応です。`);
    }

    // テキストをページ番号とセットで保持すると、差分から原文を開ける。
    const extracted = await extractText(document);
    const texts = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    const pages = texts.map((text, index) => ({ page: index + 1, text }));

    // 入力サイズだけでなく、抽出後の文字数にも上限をかける。
    const chars = pages.reduce((sum, page) => sum + page.text.length, 0);
    if (chars > MAX_TEXT_CHARS) {
      throw new Error(`${file.name}: 抽出テキストが多すぎます。`);
    }
    if (chars < 20) {
      throw new Error(`${file.name}: 文字を抽出できません。スキャンPDFにはOCRが必要です。`);
    }

    return {
      fileName: file.name,
      pageCount: document.numPages,
      pages,
      fields: extractFields(pages),
    };
  } finally {
    if ( "destroy" in document && typeof document.destroy === "function") {
    // 解析成功・失敗のいずれでもPDF.jsのリソースを解放する。
    await document.destroy();
  }
}
}