<!-- ファイルの用途: 自己学習のためにコードを読む順序と主要関数の役割を説明する。 -->
# ソースコードの読み進め方

READMEの環境構築に慣れたら、次の順番で確認すると処理の流れを追いやすくなります。

1. `lib/types.ts`: 正本(`source`)と比較対象(`target`)、差分、AI根拠の型を知る
2. `app/page.tsx`: Reactの`useState`と`FormData`、結果の描画を確認
3. `app/api/compare/route.ts`: Next.js Route Handlers、Node.js Runtime、HTTPエラーの扱いを確認
4. `lib/pdf.ts`: PDF署名と容量検証、unpdfによるテキスト抽出、ページ番号の保持を確認
5. `lib/compare.ts`: `extractFields()`と`compareReports()`の判定基準を確認
6. `lib/compare-flow.ts`: 厳密比較と必須LLM/RAGを組み立て、テスト可能にする方法を確認
7. `lib/rag-core.ts`: `makeChunks()`、`cosineSimilarity()`、`rankEvidence()`を理解
8. `lib/rag.ts`: Embedding APIへのバッチ送信と根拠検索を確認
9. `lib/llm.ts`: Responses APIとStructured Outputsによるレビュー生成を確認
10. `lib/ai-guard.ts`: 根拠IDと応答構造の検証を確認
11. `tests/`: 各関数でどの条件をテストしているかを確認

## 学習時の観点

- なぜ数値の差分をLLMに判定させないのか
- EmbeddingとLLMの役割がどう異なるのか
- エラー時に比較完了を返さないのはなぜか
- 正本と比較対象の出典ページを維持するにはどうすればよいか
- テストで外部APIをモックに置き換えるメリットは何か
- App Routerのクライアント・サーバー処理をどう分離するか

## 制約

現在のRAGはPostgreSQL/pgvectorを使用せず、リクエスト単位でEmbeddingを生成する方式です。検索対象を全文チャンクに改善した一方、LLMへ渡す根拠は各PDF上位5件のみです。完全な照合を保証しません。
