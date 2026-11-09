/**
 * ファイルの用途: Next.js App Routerの共通レイアウト。
 * 主な処理: 全ページのHTML骨格と共通CSSを読み込み、ページのメタ情報を定義する。
 * 補足: 個別画面の処理はapp/page.tsxへ分離する。
 */

import type { Metadata } from "next";
import "./globals.css";

// App Routerの共通レイアウト。ページタイトルや説明文はここで設定する。
export const metadata: Metadata = {
  title: "ReportDiff AI | 月次作業報告書 AI差分チェックシステム",
  description: "正本PDFを基準に、月次作業報告書の差分をチェックします。",
};

/** すべての画面に共通するHTMLルート。 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}