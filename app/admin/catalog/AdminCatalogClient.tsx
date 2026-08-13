"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogSubmission } from "../../../lib/catalog";

const crawlStatusLabels = { matched: "已命中", not_found: "未命中", blocked: "访问受限", error: "采集失败" } as const;
const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;

type Change = {
  id: string;
  identity_key: string;
  change_type: string;
  payload_json: string;
  source_url: string;
  status: string;
  collected_at: string;
};

function ChangeCard({ change, onReviewed }: { change: Change; onReviewed: () => void }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const payload = JSON.parse(change.payload_json) as CatalogSubmission;
  const reviewImage = payload.crawlAttempts?.find((attempt) => attempt.status === "matched" && attempt.previewImageUrl);

  async function review(action: "approve" | "reject") {
    const note = action === "reject" ? window.prompt("请输入驳回原因") : window.prompt("审核备注（可选）", "规格与来源已核对");
    if (action === "reject" && !note?.trim()) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/catalog/changes/${change.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await response.json().catch(() => ({ error: `审核接口返回异常（HTTP ${response.status}）` }));
      if (!response.ok) throw new Error(data.details?.join("；") || data.error || "审核失败");
      onReviewed();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "审核失败");
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="review-card">
      <div className="review-card-head">
        <div><span>{payload.board.brand} · {payload.board.year}</span><h2>{payload.board.model}</h2></div>
        <b>{payload.board.variants.length} 个尺码</b>
      </div>
      {reviewImage ? <figure className="review-product-image"><img /* eslint-disable-line @next/next/no-img-element */ src={reviewImage.previewImageUrl} alt={`${payload.board.brand} ${payload.board.model} 官网示例图`} /><figcaption>品牌官网示例图 · 仅供审核核对，不作为推荐页官方店铺主图</figcaption></figure> : <div className="review-image-missing">官网未提供可用示例图</div>}
      <dl className="review-specs">
        <div><dt>板型</dt><dd>{payload.board.profile} · {payload.board.shape}</dd></div>
        <div><dt>硬度</dt><dd>{payload.board.flex} / 10</dd></div>
        <div><dt>价格</dt><dd>{payload.price ? `${money(payload.price.amount, payload.price.currency)} · ${payload.price.priceLabel}` : "暂未获取到价格"}</dd></div>
        <div><dt>采集时间</dt><dd>{new Date(change.collected_at).toLocaleString("zh-CN")}</dd></div>
      </dl>
      <div className="variant-preview">{payload.board.variants.map((variant) => <span key={`${variant.size}-${variant.waist}`}>{variant.sizeLabel ?? variant.size} cm · {variant.waist} mm · {variant.weightMin}–{variant.weightMax} kg</span>)}</div>
      {payload.specificationSource.normalizationNotes?.length ? <div className="normalization-notes"><b>标准化说明</b><ul>{payload.specificationSource.normalizationNotes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}
      <section className="crawl-results">
        <div className="crawl-results-title"><b>爬虫结果</b><span>{payload.crawlAttempts?.length ?? 0} 个来源</span></div>
        {payload.crawlAttempts?.length ? payload.crawlAttempts.map((attempt) => (
          <article key={`${attempt.sourceType}-${attempt.sourceUrl}`}>
            {attempt.previewImageUrl || attempt.imageUrl ? <img /* eslint-disable-line @next/next/no-img-element */ src={attempt.previewImageUrl ?? attempt.imageUrl} alt={`${payload.board.brand} ${payload.board.model} 采集示例图`} /> : <div className="crawl-image-empty">无示例图</div>}
            <div><strong>{attempt.platform} · {attempt.sourceName}</strong><span className={`crawl-status status-${attempt.status}`}>{crawlStatusLabels[attempt.status]}</span><small>{attempt.rawPrice ? `原始价格 ${money(attempt.rawPrice.amount, attempt.rawPrice.currency)}` : attempt.message ?? "未获取价格"}</small><a href={attempt.sourceUrl} target="_blank" rel="noreferrer">打开采集来源 ↗</a></div>
          </article>
        )) : <p>这条旧数据没有保存采集尝试记录。</p>}
      </section>
      <div className="source-links">
        <a href={payload.specificationSource.sourceUrl} target="_blank" rel="noreferrer">查看规格来源 ↗</a>
        {payload.price && payload.price.sourceUrl !== payload.specificationSource.sourceUrl && <a href={payload.price.sourceUrl} target="_blank" rel="noreferrer">查看价格来源 ↗</a>}
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <footer><button disabled={sending} className="reject-button" onClick={() => review("reject")}>驳回</button><button disabled={sending} className="approve-button" onClick={() => review("approve")}>{sending ? "处理中…" : "批准发布"}</button></footer>
    </article>
  );
}

export default function AdminCatalogClient({ userEmail }: { userEmail: string }) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/admin/catalog/changes?status=pending", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法读取审核队列");
      setChanges(data.changes);
      setStatus("ready");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "无法读取审核队列");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/catalog/changes?status=pending", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "无法读取审核队列");
        setChanges(data.changes);
        setStatus("ready");
      })
      .catch((reason) => {
        setMessage(reason instanceof Error ? reason.message : "无法读取审核队列");
        setStatus("error");
      });
  }, []);

  return (
    <main className="admin-shell">
      <header className="admin-header"><Link href="/"><span>雪</span> BOARDWISE</Link><div><small>当前审核员</small><b>{userEmail}</b></div></header>
      <section className="admin-hero"><span className="eyebrow">CATALOG REVIEW</span><h1>雪板数据审核台</h1><p>采集数据只有在规格、型号、雪季和来源全部确认后，才会进入正式推荐目录。</p></section>
      <section className="review-queue">
        <div className="review-title"><div><span>待审核队列</span><h2>{status === "ready" ? `${changes.length} 条变更` : "正在读取…"}</h2></div><button onClick={load}>刷新</button></div>
        {status === "error" && <div className="admin-empty"><h3>无法打开审核队列</h3><p>{message}</p></div>}
        {status === "ready" && !changes.length && <div className="admin-empty"><h3>目前没有待审核数据</h3><p>新的采集结果会在这里等待人工确认。</p></div>}
        <div className="review-list">{changes.map((change) => <ChangeCard key={change.id} change={change} onReviewed={load} />)}</div>
      </section>
    </main>
  );
}
