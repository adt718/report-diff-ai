/**
 * ファイルの用途: PDF比較アプリのメイン画面（クライアントコンポーネント）。
 * 主な処理: 正本・比較対象PDFの選択、APIへの送信、比較結果・AI分析・PDFプレビューを描画する。
 * 補足: ブラウザー側の状態管理とユーザー操作を担当する。
 */

"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CompareResponse, Difference, Mode } from "../lib/types.ts";

// APIのコード値を、画面に表示する日本語へ変換する。
const statusLabels: Record<Difference["status"], string> = {
  match: "一致",
  changed: "不一致",
  "source-only": "正本のみ",
  "target-only": "比較対象のみ",
  missing: "両方未検出",
};

/** 比較結果の重要度とステータスから、色分け用のCSSクラスを決める。 */
function statusType(diff: Difference): string {
  if (diff.status === "match") return "ok";
  if (diff.severity === "critical") return "bad";
  if (diff.severity === "warning") return "warn";
  return "note";
}

/** null（未検出）は画面上では長音記号で表す。 */
const displayValue = (value: string | null) => value ?? "—";

/**
 * PDFファイルをブラウザー内で表示できる一時的なURLに変換するカスタムフック。
 *
 * Reactの再レンダーごとにBlob URLを増やさないため、useEffect内で発行する。
 * 別のファイルに差し替えたり、画面から離れたりした際は必ず解放する。
 */
function usePdfPreviewUrl(file: File | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

type Filter = "issues" | "all" | "critical";
type DocumentSide = "source" | "target";

export default function Page() {
  // --- 入力フォームの状態 ---
  const [source, setSource] = useState<File | null>(null); // 正本PDF
  const [target, setTarget] = useState<File | null>(null); // 比較対象PDF
  const [mode, setMode] = useState<Mode>("same-month");

  // --- API呼び出し・結果の状態 ---
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("issues");

  // --- PDFプレビューの状態 ---
  const sourceUrl = usePdfPreviewUrl(source);
  const targetUrl = usePdfPreviewUrl(target);
  const [activeDoc, setActiveDoc] = useState<DocumentSide>("source");
  const [activePage, setActivePage] = useState(1);

  /**
   * 表示対象の差分だけを絞り込む。
   * useMemoで結果・フィルター変更時以外の無駄な再計算を避ける。
   */
  const filtered = useMemo(() => {
    if (!result) return [];
    return result.differences.filter((diff) => {
      if (filter === "all") return true;
      if (filter === "critical") return diff.severity === "critical" && diff.status !== "match";
      return diff.status !== "match";
    });
  }, [result, filter]);

  /** ファイル・比較条件を変更した場合、以前の結果を消して取り違えを防ぐ。 */
  function resetResult() {
    setResult(null);
    setError("");
  }

  /**
   * 「PDFを比較する」ボタンが押された時の処理。
   * FormDataでファイル本体を送信し、JSONの差分結果を受け取る。
   */
  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // ブラウザー標準のページ遷移を防ぐ
    if (!source || !target) {
      setError("正本PDFと比較対象PDFを選択してください。");
      return;
    }

    const form = new FormData();
    form.set("source", source);
    form.set("target", target);
    form.set("mode", mode);

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        body: form, // FormDataのContent-Type境界はfetchが自動設定する
        cache: "no-store",
      });
      const data: CompareResponse | { error: string } = await response.json();
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "比較処理でエラーが発生しました。");
      }
      // APIの想定外の応答も、AI未実行なら成功として表示しない。
      if (!data.aiReview || !data.aiReview.overview || !Array.isArray(data.aiReview.evidence)) {
        throw new Error("AI + RAGの結果が含まれないため比較を完了できません。");
      }
      setResult(data);
      setFilter("issues"); // 新しい結果は、まず差分のみ表示する
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "比較処理でエラーが発生しました。");
    } finally {
      setLoading(false); // 成否にかかわらずローディングを解除する
    }
  }

  /** 差分の出典ページをクリックしたら、該当PDFのプレビューを開く。 */
  function viewPage(documentSide: DocumentSide, page: number | null) {
    if (!page) return;
    setActiveDoc(documentSide);
    setActivePage(page);
    document.getElementById("pdf-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const pdfUrl = activeDoc === "source" ? sourceUrl : targetUrl;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">≋</span>
          <span>ReportDiff AI <small>月次作業報告書の監査補助</small></span>
        </div>
        <span className="topchip">MVP 0.1</span>
      </header>

      <section className="hero">
        <div className="eyebrow">PDF source of truth</div>
        <h1>作業報告書の差分を、<br /><em>見落とさず確認。</em></h1>
        <p>
          正本PDFを基準に、稼働時間・報告年月・案件情報・本文の記載差分を比較。
          <br className="desktop" />LLM + RAGを毎回実行し、作業内容の意味的な違いも根拠付きで検討します。
        </p>
      </section>

      {/* 01: アップロード画面。file入力を使い、PDFをブラウザーから選ぶ。 */}
      <form className="panel upload-panel" onSubmit={compare}>
        <div className="panel-heading">
          <h2>01 <span>比較するPDFを選択</span></h2>
          <span className="muted small">PDF / 各10MBまで / 最大30ページ</span>
        </div>

        <div className="upload-grid">
          <label className="droparea">
            <span className="file-badge source-badge">正本・基準</span>
            <span className="drop-symbol">▤</span>
            <strong>{source ? source.name : "正本PDFを選択"}</strong>
            <span>{source ? `${(source.size / 1024 / 1024).toFixed(2)} MB` : "クリックしてファイルを指定"}</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setSource(event.target.files?.[0] ?? null);
                resetResult();
              }}
            />
          </label>

          <label className="droparea">
            <span className="file-badge target-badge">比較対象</span>
            <span className="drop-symbol">▤</span>
            <strong>{target ? target.name : "比較対象PDFを選択"}</strong>
            <span>{target ? `${(target.size / 1024 / 1024).toFixed(2)} MB` : "クリックしてファイルを指定"}</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setTarget(event.target.files?.[0] ?? null);
                resetResult();
              }}
            />
          </label>
        </div>

        {/* 2つのモードは重要度判定を変更する。異月比較は数値変更を原則「参考」とする。 */}
        <div className="options-grid">
          <fieldset className="mode-options">
            <legend>比較モード</legend>
            <label>
              <input
                type="radio"
                checked={mode === "same-month"}
                onChange={() => { setMode("same-month"); resetResult(); }}
              />
              同じ月の正本・提出版を比較
            </label>
            <label>
              <input
                type="radio"
                checked={mode === "cross-month"}
                onChange={() => { setMode("cross-month"); resetResult(); }}
              />
              異なる月の報告書を比較
            </label>
          </fieldset>

          {/* AI + RAGは必須なので、OFFにできるチェックボックスを設置しない。 */}
          <div className="ai-option" role="note" aria-label="AI + RAG必須">
            <span className="mandatory-mark" aria-hidden="true">✓</span>
            <span>
              <strong>AI + RAG分析 <span className="required-tag">必須</span></strong>
              <small>毎回、EmbeddingでPDFの関連箇所を検索し、LLMで内容を照合します。PDF由来のテキストをOpenAI APIへ送信します。APIキーの設定と従量課金が必要です。</small>
            </span>
          </div>
        </div>

        <button className="primary-btn" type="submit" disabled={loading || !source || !target}>
          {loading ? "PDF解析・AI + RAG照合中…" : "PDFを比較する（AI + RAG必須） →"}
        </button>
        {error && <p role="alert" className="error-message">{error}</p>}
        <p className="privacy-note">
          PDFファイル自体は永続保存しませんが、抽出したテキストの一部をOpenAI APIへ送信します。機密情報の取扱いを確認してください。スキャンPDFは未対応です。
        </p>
      </form>

      {/* 比較前には結果セクションを表示しない。 */}
      {result && (
        <>
          {/* 02: 決定論的な数値照合とAI分析の両方が完了した場合のみ表示 */}
          <section className="panel result-panel">
            <div className="panel-heading">
              <h2>02 <span>比較結果</span></h2>
              <span className="muted small">{result.mode === "same-month" ? "同月比較" : "月次推移・参考差分"}</span>
            </div>
            <div className="stats-grid">
              <div className="stat"><b>{result.summary.matches}</b><span>一致した項目</span></div>
              <div className="stat red"><b>{result.summary.mismatches}</b><span>重要な不一致</span></div>
              <div className="stat orange"><b>{result.summary.needsReview}</b><span>要確認の項目・行</span></div>
              <div className="stat"><b>{result.summary.totalTextDifferences}</b><span>本文の差分行数</span></div>
            </div>
            <p className="explain">
              {result.mode === "cross-month"
                ? "異なる月の差分は変化として表示し、誤りとは断定しません。"
                : "重要な不一致は赤色で表示します。抽出できない項目は未検出となるため原本確認が必要です。"}
            </p>

            {/* 絞り込みはクライアントだけで行う。APIへの再リクエストは不要。 */}
            <div className="tabbar">
              <button type="button" className={filter === "issues" ? "selected" : ""} onClick={() => setFilter("issues")}>差分のみ</button>
              <button type="button" className={filter === "critical" ? "selected" : ""} onClick={() => setFilter("critical")}>重要な不一致</button>
              <button type="button" className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>すべての項目</button>
            </div>

            <div className="table-wrap">
              <table className="differences">
                <thead><tr><th>比較対象</th><th>正本PDF</th><th>比較対象PDF</th><th>判定</th></tr></thead>
                <tbody>
                  {filtered.map((diff) => (
                    <tr key={diff.id}>
                      <td>
                        <strong>{diff.title}</strong>
                        <small>{diff.category === "field" ? "項目の比較" : "本文の差分"}</small>
                      </td>
                      <td>
                        <div className="cell-text">{displayValue(diff.sourceValue)}</div>
                        {diff.sourcePage && (
                          <button type="button" className="page-link" onClick={() => viewPage("source", diff.sourcePage)}>
                            正本 p.{diff.sourcePage} ↗
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="cell-text">{displayValue(diff.targetValue)}</div>
                        {diff.targetPage && (
                          <button type="button" className="page-link" onClick={() => viewPage("target", diff.targetPage)}>
                            対象 p.{diff.targetPage} ↗
                          </button>
                        )}
                      </td>
                      <td><span className={`pill ${statusType(diff)}`}>{statusLabels[diff.status]}</span></td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={4} className="empty">この条件に該当する差分はありません。</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 表の表示件数制限や未対応PDF形式を、成功結果でも必ず伝える。 */}
            {result.warnings.length > 0 && (
              <div className="warning-panel">
                <strong>確認上の注意</strong>
                <ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
              </div>
            )}
          </section>

          {/* 03: AI + RAG分析は必須。API成功時には必ずこのセクションを表示する。 */}
          <section className="panel ai-panel">
              <div className="panel-heading">
                <h2>03 <span>AI + RAGレビュー</span></h2>
                <span className="ai-tag">必須分析・完了</span>
              </div>
              <p className="ai-overview">{result.aiReview.overview}</p>
              {result.aiReview.findings.length === 0 && (
                <p className="muted small">AIは追加の指摘を検出しませんでした。ただし内容の完全一致を保証するものではありません。</p>
              )}
              {result.aiReview.findings.map((finding, index) => (
                <div className="ai-finding" key={index}>
                  <div className="finding-head">
                    <span className={`pill ${finding.severity === "critical" ? "bad" : finding.severity === "warning" ? "warn" : "note"}`}>
                      {finding.severity === "critical" ? "重要" : finding.severity === "warning" ? "要確認" : "参考"}
                    </span>
                    <strong>{finding.title}</strong>
                  </div>
                  <p>{finding.explanation}</p>

                  {/* LLMの根拠IDを、サーバーから返された出典一覧と照合してリンク表示。 */}
                  <div className="evidence-links">
                    {finding.evidenceIds.map((id) => {
                      const evidence = result.aiReview.evidence.find((item) => item.id === id);
                      if (!evidence) return null;
                      return (
                        <button key={id} type="button" onClick={() => viewPage(evidence.document, evidence.page)}>
                          {evidence.document === "source" ? "正本" : "比較対象"} p.{evidence.page} · {id} ↗
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </section>

          {/* APIではPDFを返さず、ユーザーが選んだFileのBlob URLでプレビューする。 */}
          <section className="panel preview-panel" id="pdf-preview">
            <div className="panel-heading">
              <h2>PDFプレビュー</h2>
              <div className="preview-switch">
                <button type="button" className={activeDoc === "source" ? "selected" : ""} onClick={() => setActiveDoc("source")}>正本</button>
                <button type="button" className={activeDoc === "target" ? "selected" : ""} onClick={() => setActiveDoc("target")}>比較対象</button>
              </div>
            </div>
            <p className="muted small">PDF内のページ移動はブラウザーのPDFビューアーに依存します。</p>
            {pdfUrl && (
              <iframe
                key={`${activeDoc}-${activePage}`}
                title="PDFプレビュー"
                src={`${pdfUrl}#page=${activePage}`}
                className="pdf-frame"
              />
            )}
          </section>
        </>
      )}

      <footer className="footer">ReportDiff AI — PDF正本を尊重した差分確認ツール / 試作版</footer>
    </main>
  );
}
