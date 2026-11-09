<!-- ファイルの用途: 技術選定理由と各モジュールの責務を説明する設計資料。 -->
# アーキテクチャと技術選定

## 役割分担

- **Next.js App Router**: `app/page.tsx`がUI、`app/api/compare/route.ts`がHTTP入口。PDF解析はサーバーのNode.js Runtimeで行う。
- **React**: アップロード、モード選択、ローディング、エラー、比較表、PDFプレビューの状態管理。
- **TypeScript**: `lib/types.ts`でデータ契約を定義し、正本(`source`)と比較対象(`target`)を区別する。
- **lib/pdf.ts**: unpdfによるテキスト抽出。ページ番号を保持し、画像だけのPDFは拒否。
- **lib/compare.ts**: 単純な文字列比較に加え全角半角・時間単位・年月を正規化した厳密照合。数値の根拠はAIに委ねない。
- **lib/compare-flow.ts**: 厳密比較と必須AIレビューを統合。分析関数の注入でテストしやすくする。
- **lib/rag-core.ts**: 全チャンク生成とコサイン類似度。外部SDKへの依存なし。
- **lib/rag.ts**: Embeddings APIへ全チャンクを分割送信し、正本・対象からそれぞれ関連根拠上位5件を取り出す。
- **lib/llm.ts**: Responses APIのStructured Outputsで概要と指摘をJSONで取得。
- **lib/ai-guard.ts**: JSONを再検証し、LLMの根拠IDが実在するか検査。

## なぜLLMだけで比較しない？

稼働時間が160hと152hならプログラムで確定できます。一方「APIの不具合対応」と「バックエンドの障害修正」は意味が似ている可能性があり、RAG＋LLMで根拠を添えて補助判断します。LLMの指摘が不適切でも厳密比較の結果は書き換えません。

## なぜNext.jsを採用した？

フロントエンド（Client Components）とサーバー側のPDF解析・OpenAI API連携（Route Handlers）を同一のTypeScriptプロジェクトで実現でき、既存のReact経験とNext.js固有の知識を一緒に学習できるからです。Next.jsを画面表示だけでなくAPIの中核に使っています。

## RAGの限界

RAGは関連情報の**検索**であり全件網羅の監査ではありません。全チャンクをEmbeddingの検索対象にしますが、LLMに渡すのは双方各5件です。実務用には日付・作業項目の構造化抽出、計算規則、原文レイアウトでの照合、OCRと監査ログを別途整備する必要があります。

## データ保護

PDF自体はサーバーに永続化しませんが、Embedding APIとResponses APIへ一部テキストを送信します。業務機密の送信には明示的な許可が必要です。公開運用には認証・マルウェア対策・レート制限・権限管理が必要です。
