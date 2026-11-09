> **このファイルの用途：** Next.jsを中核にした月次作業報告書PDF比較アプリの目的、構成、Windows＋WSL2＋Docker Desktop環境構築、テスト手順、制限事項を説明します。
>
> **対象：** 自己学習・ポートフォリオ用MVP。業務運用前には実際の帳票レイアウト・送信許可・セキュリティの追加検証が必要です。

# ReportDiff AI — 月次作業報告書 AI差分チェックシステム

**プロジェクト名：** `ReportDiff AI`（ディレクトリ名・npmパッケージ名：`report-diff-ai`）

「**正本PDFを基準**」に、比較対象PDFの稼働時間・作業日数・担当者・案件・本文を照合するWebアプリケーションです。数値や日付は**プログラムで厳密比較**し、作業内容の言い換えなどの意味的な違いは**RAGで根拠を検索した上でLLMが補足分析**します。

- **Next.js 16 App Router** / React 19 / TypeScript / Node.js 24
- **npm**で依存関係を管理（Yarnは使用しない）
- **LLM＋RAGは必須**。設定不足や通信エラー時に「比較完了」と表示しない
- **Docker Desktop＋WSL2＋Linuxコンテナ**で開発する
- ソースコードの**先頭に日本語で用途を記述**し、主要な関数にもコメントを記述

## 1. 実装済み機能と開発状況

| 項目 | 実装 | 検証状況 |
|---|---|---|
| 正本・比較対象PDFのアップロード | 済 | HTTP経由の実行は未検証 |
| PDFテキスト抽出（unpdf、ページ番号保持） | 済 | 実PDF読込テストを追加・実行待ち |
| 対象年月・作業者・案件・作業日数・稼働時間・残業時間の比較 | 済 | 単体テスト成功 |
| 同月比較 / 異月比較 | 済 | 単体テスト成功 |
| 本文の行差分・PDFプレビュー | 済 | ブラウザーE2Eは未検証 |
| Embedding＋コサイン類似度のRAG検索 | 済 | 純粋関数テスト成功、実API未検証 |
| OpenAI Responses APIによるLLMレビュー | 済 | 応答検証テスト成功、実API未検証 |
| Docker開発環境（Dockerfile.dev / compose.yaml） | 設定あり | Docker実起動は未検証 |
| PostgreSQL / pgvector、OCR、日別明細、ログイン | 未実装 | — |

**この配布版はMVPの改訂ソースコードです。** `npm run test:core` の19件は成功していますが、**Dockerビルド・Next.jsビルド・実際のOpenAI通信を通して検証した完成品ではありません**。実行環境にはDockerがなく、npmレジストリへの接続もできなかったため、結果を偽っていません。詳しくは[`docs/TEST_REPORT.md`](docs/TEST_REPORT.md)に記載します。

## 2. アーキテクチャ

```text
ブラウザー（Next.js Client Component）
    ├── 正本PDF（source）
    └── 比較対象PDF（target）
             │ FormData
             ▼
Next.js Route Handler: POST /api/compare (Node.js Runtime)
             ▼
    lib/pdf.ts: unpdfによるページ別テキスト抽出
             ▼
    lib/compare-flow.ts: オーケストレーション
          ├── lib/compare.ts: 数値・日付・本文のルール比較
          └── lib/rag.ts: チャンク分割・Embedding・関連文検索
                   ├── lib/rag-core.ts: 類似度とランキング（テスト可能）
                   └── lib/llm.ts: Responses API / Structured Outputs
                            ▼
                   lib/ai-guard.ts: 根拠ID・形式の検証
             ▼
 Reactへ比較結果JSONを返す（AIエラーならHTTP 502）
```

**RAGは何をしている？** 両PDFの抽出テキストをページごとに約700文字で分割し、Embedding APIへ送信してベクトル化します。比較結果に関する検索文と各チャンクの**コサイン類似度**を計算し、正本・対象からそれぞれ上位5件を選びます。LLMはそれらとルール比較結果をもとに日本語で説明します。

- 今回のRAGは**メモリ上の検索**です。PostgreSQL/pgvectorへの永続保存は未実装です。
- チャンクはPDF全体を作成します（従来の先頭50件制限を撤廃）。ただし**検索結果は各5件**のため、すべての差分の発見を保証するものではありません。
- 極端な長文（1文書400チャンク超）は黙って一部を省略せず、エラーにします。
- ファイルはサーバーに永続保存しません。Embedding/LLMへの送信内容・APIの保持規定は別途確認してください。

詳しい技術選定と流れは [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、ファイルごとの役割は [`docs/FILE_PURPOSES.md`](docs/FILE_PURPOSES.md) を参照してください。**旧版の`README-docker-wsl2.md`とは併用せず、このREADMEの環境構築手順を正とします。**

## 3. Windows 11 + WSL2 + Docker Desktopの構築手順

### 3-1. 事前条件

- Windows 11、BIOS/UEFIで仮想化が有効なPC
- インターネット接続、管理者権限
- Docker Desktop（Windows版）、Visual Studio Code + WSL拡張（推奨）
- OpenAI APIキー（**ChatGPT Plus等とは別契約・従量課金**）

### 3-2. WSL2 / Ubuntuのインストール【Windows PowerShell 管理者】

```powershell
# Ubuntuを導入（インストール済みなら不要）
wsl --install -d Ubuntu
# WSLを更新
wsl --update
# UbuntuがVERSION 2で動いているか確認
wsl --list --verbose
```

必要なら再起動し、Ubuntu初回起動でLinuxユーザーを設定します。`VERSION 1`なら `wsl --set-version Ubuntu 2` を実行します。

### 3-3. Docker Desktopの導入【Windows】

1. [Docker Desktop公式サイト](https://www.docker.com/products/docker-desktop/)からインストールします。
2. Docker Desktopを起動し、`Settings > General > Use WSL 2 based engine`を有効にします（自動設定済みの場合は表示されないこともあります）。
3. `Settings > Resources > WSL Integration`で**Ubuntu**を有効にし、適用・再起動します。
4. **Linuxコンテナモード**であることを確認します。Ubuntu内にDocker Engineを二重インストールする必要はありません。

公式ガイド: [Docker Desktop on WSL2](https://docs.docker.com/desktop/features/wsl/)

### 3-4. Docker起動の確認【Windows PowerShell → Ubuntuターミナル】

```powershell
# Windows側
docker --version
docker compose version
docker run --rm hello-world
```

```bash
# Ubuntu側（WSL Integrationの確認）
docker version
docker compose version
```

`docker version`がClientとServerの両方を出力できればDockerに接続できています。

### 3-5. ソースコードの配置【Ubuntuターミナル】

ReportDiff AIのソースは、Windows側の`C:\...`やWSLの`/mnt/c/...`に直接置かず、**Ubuntu内の**`/home/ists/projects/report-diff-ai`に展開します。Linux側のファイルシステムを使うと、Next.jsのファイル監視やコンテナとのファイル共有が安定しやすくなります。

最新版のZIP `report-diff-ai-nextjs-npm.zip` がWindowsの`C:\Users\ists\Downloads`にある場合は、Ubuntuで次を実行してください。

```bash
# 展開先を作成
mkdir -p ~/projects

# ZIPに含まれるreport-diff-ai/フォルダーごと展開
unzip /mnt/c/Users/ists/Downloads/report-diff-ai-nextjs-npm.zip -d ~/projects/

# プロジェクトルートを開く
cd ~/projects/report-diff-ai

# 必要な設定ファイルを確認
ls -l README.md package.json compose.yaml Dockerfile.dev

# VS Code（WSL拡張がある場合）で開く
code .
```

`unzip: command not found`と表示された場合は、Ubuntuで`sudo apt update && sudo apt install -y unzip`を実行してください。ZIPの名前やWindowsユーザー名が違う場合は、実際の環境に合わせて読み替えます。

Windowsエクスプローラーから編集する場合は、`\\wsl$\Ubuntu\home\ists\projects\report-diff-ai`で開くこともできます。ただし、開発時はVS CodeのWSL拡張で開く方法を推奨します。

### 3-6. OpenAIの環境変数

```bash
cp .env.example .env.local
nano .env.local
```

`.env.local`の例：

```dotenv
OPENAI_API_KEY=実際のAPIキー
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

`.env.local`はGit追跡対象外です。APIキーをチャット・README・Gitへ転載しないでください。利用可能なLLMモデルIDは契約とプロジェクト設定により異なるため、必要なら `OPENAI_MODEL` を変更してください。

### 3-7. DockerでNext.jsを起動【Ubuntuターミナル】

```bash
# Compose構成の検証（ファイルが読めるか確認）
docker compose config --quiet

# 初回ビルド・起動
docker compose up --build -d

# Next.jsの起動ログ（Readyを確認）
docker compose logs -f app
```

Windowsのブラウザーで **http://localhost:3000** を開きます。ブラウザーから `sample/report_source.pdf`（160時間）と `sample/report_target.pdf`（152時間）を選択します。**実際の比較ボタンを押すとOpenAI APIに通信し、API料金が発生します**。

### 3-8. package-lock.jsonの作成と依存関係の固定（重要）

この配布物には、ネットワーク制約により **`package-lock.json` を同梱していません**。初回起動後、次の操作でホストのプロジェクトにも生成してください。

```bash
# コンテナでlockfileを生成してUbuntu側のソースディレクトリへ保存
docker compose exec app npm install --package-lock-only

# 完成したlockfileを使うnpm ciビルドへ切り替え
docker compose up -d --build

# package-lock.jsonができたことを確認
ls -lh package-lock.json
```

**`package-lock.json`はGitにコミット**し、以後は`npm ci`で依存バージョンを固定します。`package.json`を変更したら`npm install`でlockfileを更新します。

### 3-9. Dockerコンテナから各種テストを実行

```bash
# 比較ロジック・RAG純粋関数・AI応答検証・疑似結合テスト
docker compose exec app npm run test:core

# 実物のサンプルPDFをunpdfで解析（OpenAI APIには接続しない）
docker compose exec app npm run test:pdf

# TypeScript型チェック
docker compose exec app npm run typecheck
```

**実APIスモークテスト（有料）**：アプリが起動し、`.env.local`を設定した後に実行します。結果の概要・正本側根拠・比較側根拠、160時間と152時間の差分を確認します。

```bash
docker compose exec app npm run test:smoke
```

Next.jsの本番ビルドは、開発サーバーと`.next`ディレクトリの競合を避けるため別実行にします。

```bash
docker compose stop app
docker compose run --rm --no-deps app npm run build
docker compose up -d
```

### 3-10. 停止・再起動

```bash
docker compose down           # 停止。named volumeは残る
docker compose up -d          # 再起動
docker compose logs -f app    # ログ確認
# docker compose down -v はnode_modules等を消すので注意
```

## 4. Dockerを使わない実行（代替）

Node.js 24 LTSとnpmが必要です。

```bash
npm install
cp .env.example .env.local     # Windows PowerShellなら Copy-Item .env.example .env.local
# APIキーを設定後
npm run dev
npm run test:core
npm run test:pdf
npm run typecheck
```

## 5. 不一致の表示仕様

**正本（source）を常に基準**にします。例：正本160時間、比較対象152時間は「重要な不一致」です。画面では正本値・比較値・判定・該当ページを示し、ページリンクからPDFを開けます。AIレビューには概要・追加の懸念・RAG根拠IDを表示します。

- 同月の数値差異：重要な不一致
- 作業内容の変更や欠落候補：要確認
- 異月の変更：原則参考情報（ミスとは自動判定しない）
- PDFの文字そのものを色枠でハイライトする機能：未実装

## 6. 制限事項とセキュリティ

- **テキストPDFのみ**。画像スキャン・OCR・複雑な表組み・日別の明細検証は未対応。
- 項目抽出は見出しが行頭にある形式を想定。実際の帳票に合わせて`lib/compare.ts`の見出し別名を調整してください。
- 1ファイル10MB / 30ページ / 抽出文字数上限200,000文字。本文差分表示は最大80行。
- AIは誤る可能性があり、RAGも各PDF上位5件しかLLMに渡しません。**「不一致なし」でもPDF全体が完全一致した保証にはなりません**。
- 認証、権限管理、レート制限、監査ログ、ウイルス検査、暗号化永続保存は未実装です。インターネットへの公開や実務データでの運用は避けてください。
- APIへPDF由来のテキストが送られます。会社の報告書を使う場合は外部送信を許可されているか確認してください。
- Docker Composeのポートは`127.0.0.1:3000:3000`に限定してあります（ローカル開発用）。

## 7. よくあるトラブル

| 症状 | 確認すること |
|---|---|
| `docker: command not found` (Ubuntu) | Docker DesktopのWSL IntegrationでUbuntuを有効化 |
| Docker daemonに接続できない | Docker Desktop起動、WSL2、Linuxコンテナモードを確認 |
| `.env.local`がない | `cp .env.example .env.local` |
| 比較時に503 | `OPENAI_API_KEY`の未設定 |
| 比較時に502 | OpenAI APIキー・利用権限・課金状態・モデルID・ネットワークを確認 |
| 3000番ポートが使用中 | 既存サーバーを停止するかComposeのホストポートを変更 |
| PDFから文字が抽出できない | スキャンPDFかどうか確認（OCRは未実装） |
| `npm ci`がlockfile不足で失敗 | 3-8に従い`npm install --package-lock-only`で生成 |

## 8. ポートフォリオとして説明できるポイント

**Next.js App Routerの責務分離**（画面とRoute Handlers）、**型定義と数値の決定論的比較**、**RAGの検索設計**（チャンク・Embedding・コサイン類似度・出典追跡）、**LLM出力の検証**、**AIモックによる自動テスト**、**WSL2＋Dockerによる環境再現**を説明できるようにしています。

設計意図や検証の根拠は`docs/`に整理しました。実績として記載するのは、**実際に起動・確認した範囲だけ**にしてください。

## 9. 公式ドキュメント

- [Next.js App Router](https://nextjs.org/docs/app)
- [Docker Desktop WSL2](https://docs.docker.com/desktop/features/wsl/)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
