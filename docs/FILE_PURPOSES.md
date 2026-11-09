<!-- ファイルの用途: ソースコードの所在と日本語の用途をまとめる目録。 -->
# ファイル一覧

| ファイル | 用途 |
|---|---|
| `README.md` | 環境構築・機能・検証の案内 |
| `app/page.tsx` | PDFアップロードと結果・PDFプレビューを描画するReact画面 |
| `app/layout.tsx` | Next.jsの共通レイアウトとメタデータ |
| `app/globals.css` | 画面全体のスタイル |
| `app/api/compare/route.ts` | Next.js Route HandlerでPDF比較を受け付ける |
| `lib/types.ts` | レポート・差分・RAG根拠・AI回答の型定義 |
| `lib/pdf.ts` | PDF検証・文字抽出・ページ番号保持 |
| `lib/compare.ts` | 抽出項目・数値・年月・本文の決定論的比較 |
| `lib/compare-flow.ts` | 比較＋AI分析を一連の処理として統合 |
| `lib/rag-core.ts` | RAGのチャンク分割・類似度ランキング |
| `lib/rag.ts` | Embedding API通信とRAG検索の実装 |
| `lib/llm.ts` | OpenAI Responses APIのLLM分析 |
| `lib/ai-guard.ts` | AI結果と根拠IDの検証 |
| `tests/compare.test.mjs` | 正規化と決定論的比較の単体テスト |
| `tests/ai-guard.test.mjs` | AI設定・JSON・根拠IDの単体テスト |
| `tests/rag-core.test.mjs` | RAG処理の純粋関数単体テスト |
| `tests/flow.test.mjs` | AIモックを使う結合テスト |
| `tests/pdf.test.mjs` | unpdfでサンプルPDFを実際に解析するテスト |
| `scripts/smoke.mjs` | Next.js API＋OpenAI実通信のスモークテスト |
| `Dockerfile.dev` | Node.js 24の開発用Linuxイメージ定義 |
| `compose.yaml` | 開発コンテナ、ボリューム、ポート設定 |
| `.dockerignore` | Dockerビルド時の除外パターン |
| `.gitignore` | Git追跡除外パターン |
| `.env.example` | OpenAI API設定のひな形 |
| `next.config.ts` | Next.jsのサーバー構成 |
| `tsconfig.json` | TypeScriptのコンパイル設定 |
| `next-env.d.ts` | Next.jsが生成・管理する型宣言 |
| `package.json` | npm依存関係と実行スクリプト（JSONにコメント不可） |
| `sample/report_source.pdf` | テスト用正本PDF |
| `sample/report_target.pdf` | テスト用比較対象PDF |
| `docs/ARCHITECTURE.md` | 技術選定・責務・限界 |
| `docs/TEST_REPORT.md` | 実行済みテスト・未検証事項 |
| `docs/COMMENT_GUIDE.md` | ソースコードの読み進め方 |

`package-lock.json` は配布時未生成で、初回の`npm install`によって生成してください。PDFの内部にソースコメントは付与できません。
