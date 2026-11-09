/**
 * ファイルの用途: Next.jsのサーバー設定ファイル。
 * 主な処理: PDF抽出ライブラリunpdfをサーバー外部パッケージとして扱う設定を記述する。
 * 補足: アプリのビジネスロジックは含まない。
 */

import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf"],
};
export default nextConfig;
