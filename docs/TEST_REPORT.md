<!-- ファイルの用途: 実施したテストと未検証の範囲を分けて記録する。 -->
# テスト実行記録（2026-11-06）

## 実行できた項目

- `npm run test:core`: **19件成功、失敗0件**。
  - 数値・日付・本文の差分比較（6件）
  - AI設定・応答・根拠ID検証（6件）
  - RAGチャンク・類似度・根拠検索（4件）
  - 比較フローの疑似結合テスト（3件）
- Node.js v22.16.0上で上記のTypeScript型を取り除くテストランナーを利用。**本番推奨のNode.js 24上では未検証**。

## 未検証の項目

| コマンド | 目的 | 実行できなかった理由 |
|---|---|---|
| `npm install` / `npm ci` | 依存関係のインストール | npmレジストリのDNS解決に失敗 |
| `npm run test:pdf` | unpdfによる実PDF解析 | unpdf未インストール |
| `npm run typecheck` | Next.jsを含む型チェック | 依存型宣言未インストール |
| `npm run build` | Next.js本番ビルド | Next.js未インストール |
| `docker compose up --build -d` | Linuxコンテナ起動 | Dockerコマンドが実行環境にない |
| `npm run test:smoke` | OpenAI実API込みのHTTP結合確認 | APIキー・Next.js起動環境なし |
| ブラウザーのE2E | 実ユーザー操作の検証 | ブラウザー環境・テスト基盤未整備 |

## 実際のWindows環境での受け入れテスト

1. READMEの手順に従いDocker Desktop＋WSL2から起動できる。
2. `npm run test:core`と`npm run test:pdf`が成功する。
3. `npm run typecheck`と`npm run build`が成功する。
4. `sample/report_source.pdf`（160時間）と`sample/report_target.pdf`（152時間）をアップロードすると、**稼働時間の重要な不一致**が表示される。
5. `npm run test:smoke`でAI概要と双方のPDF根拠が取得できる。
6. APIキーを空にするとHTTP 503、AI通信を失敗させるとHTTP 502になり、完了扱いしない。
7. 正本と比較対象のページリンクがそれぞれ対応するPDFを開く。

**重要**: 実行前の期待結果であり、未検証項目の成功を意味しません。
