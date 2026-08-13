"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  defaultProfile,
  estimateMondo,
  PROFILE_LIMITS,
  Profile,
  ProfileField,
  ProfileValidationErrors,
  Recommendation,
  ShoeMode,
  Style,
  validateProfile,
} from "../lib/recommendation";

const steps = ["身体与脚型", "技术能力", "滑行偏好", "预算确认"];
const stepFields: ProfileField[][] = [
  ["height", "weight", "shoeValue"],
  ["snowDays"],
  [],
  ["budget"],
];

const styleLabels: Record<Style, { title: string; copy: string }> = {
  "all-mountain": { title: "全山滑行", copy: "雪道为主，偶尔探索其他地形" },
  carving: { title: "雪道 / 刻滑", copy: "追求稳定、抓边和完整弧线" },
  freestyle: { title: "平花 / 公园", copy: "关注灵活、反脚和动作表现" },
  powder: { title: "粉雪 / 野雪", copy: "重视浮力、方向性和复杂地形" },
};

function OptionCard({ active, title, copy, onClick }: { active: boolean; title: string; copy: string; onClick: () => void }) {
  return (
    <button type="button" className={`option-card ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      <span className="option-dot" />
      <strong>{title}</strong>
      <small>{copy}</small>
    </button>
  );
}

function Results({ profile, items, catalogMode, onRestart }: { profile: Profile; items: Recommendation[]; catalogMode: "demo" | "database"; onRestart: () => void }) {
  const shoe = estimateMondo(profile);
  const [aiCopy, setAiCopy] = useState("正在整理你的个性化选板结论…");
  const [feedback, setFeedback] = useState<"idle" | "sending" | "done">("idle");

  useEffect(() => {
    const fallback = `你目前更适合兼顾容错与成长空间的板型。${shoe.estimated ? `日常鞋码暂估为 Mondo ${shoe.mondo}，板宽结论需要在测量脚长后复核。` : "脚长信息明确，因此板宽判断具备较高置信度。"}`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    fetch("/api/ai-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, recommendations: items.map((item) => ({ model: `${item.board.brand} ${item.board.model}`, size: item.variant.size, reasons: item.reasons })) }),
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setAiCopy(data.answer || fallback))
      .catch(() => setAiCopy(fallback))
      .finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [items, profile, shoe.estimated, shoe.mondo]);

  async function sendFeedback(rating: number) {
    setFeedback("sending");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, selectedBoard: items[0]?.board.id, profile: { ...profile, height: Math.round(profile.height / 5) * 5, weight: Math.round(profile.weight / 5) * 5 } }),
      });
    } finally {
      setFeedback("done");
    }
  }

  if (!items.length) {
    return (
      <section className="empty-state">
        <span className="eyebrow">需要更多信息</span>
        <h2>暂时没有满足硬性条件的雪板</h2>
        <p>我们没有放宽体重与板宽条件。请返回调整预算，或补充准确脚长后再试一次。</p>
        <button className="primary-button" onClick={onRestart}>返回修改</button>
      </section>
    );
  }

  return (
    <main className="results-shell">
      <header className="results-header">
        <button className="brand-button" onClick={onRestart}><span>雪</span> BOARDWISE</button>
        <button className="ghost-button" onClick={onRestart}>重新测试 ↗</button>
      </header>

      <section className="result-hero">
        <div>
          <span className="eyebrow dark">YOUR BOARD MATCH · 推荐完成</span>
          <h1>最适合你的，<br />不是最贵的那块。</h1>
        </div>
        <div className="ai-summary">
          <span className="ai-mark">AI</span>
          <p>{aiCopy}</p>
          <small>规则引擎筛选 · AI 负责解释</small>
        </div>
      </section>

      {catalogMode === "demo" && <aside className="catalog-notice"><strong>演示目录</strong><span>正式雪板数据正在经过来源核验与人工审核；当前结果仍使用内置演示数据。</span></aside>}

      {shoe.estimated && (
        <aside className="shoe-warning">
          <strong>板宽为估算结果</strong>
          <span>日常 EU {profile.shoeValue} 暂估为 Mondo {shoe.mondo}。购板前请靠墙测量脚长，或试穿雪鞋后再确认。</span>
        </aside>
      )}

      <section className="recommendation-list">
        {items.map((item, index) => (
          <article className={`board-card board-${index + 1}`} key={item.board.id}>
            <div className="rank-column">
              <span className="rank">0{index + 1}</span>
              <span className="role">{item.role}</span>
            </div>
            <div className="board-visual" style={{ "--board-color": item.board.color } as React.CSSProperties}>
              <span>{item.board.brand}</span>
              <i />
              <b>{item.variant.size}</b>
            </div>
            <div className="board-main">
              <div className="board-title-row">
                <div>
                  <span>{item.board.brand} · {item.board.year}</span>
                  <h2>{item.board.model}</h2>
                </div>
                <div className="confidence"><small>匹配度</small><strong>{Math.min(98, Math.round(item.score))}%</strong></div>
              </div>
              <div className="spec-row">
                <span><small>推荐长度</small><strong>{item.variant.size} cm</strong></span>
                <span><small>板腰</small><strong>{item.variant.waist} mm</strong></span>
                <span><small>硬度</small><strong>{item.board.flex} / 10</strong></span>
                <span><small>置信度</small><strong>{item.confidence}</strong></span>
              </div>
              <ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <div className="caution"><b>购买前确认</b>{item.caution}</div>
              <footer>
                <div>{item.board.priceInfo ? <><small>{item.board.priceInfo.priceLabel} · {new Date(item.board.priceInfo.observedAt).toLocaleDateString("zh-CN")} 核验</small><strong>¥{item.board.priceInfo.amount.toLocaleString("zh-CN")}</strong><a className="price-source" href={item.board.priceInfo.sourceUrl} target="_blank" rel="noreferrer">{item.board.priceInfo.sourceName} ↗</a></> : catalogMode === "demo" ? <><small>演示参考价</small><strong>¥{item.board.price.toLocaleString("zh-CN")}</strong></> : <><small>价格</small><strong className="no-price">暂无已核验价格</strong></>}</div>
                <span>{item.board.profile} · {item.board.shape}</span>
              </footer>
            </div>
          </article>
        ))}
      </section>

      <section className="compare-section">
        <div className="section-heading">
          <span className="eyebrow">QUICK COMPARE</span>
          <h2>一眼看懂三块板</h2>
        </div>
        <div className="compare-table">
          <div className="compare-row compare-head"><span>型号</span>{items.map((item) => <b key={item.board.id}>{item.board.model}</b>)}</div>
          <div className="compare-row"><span>定位</span>{items.map((item) => <b key={item.board.id}>{item.role}</b>)}</div>
          <div className="compare-row"><span>板型</span>{items.map((item) => <b key={item.board.id}>{item.board.shape}</b>)}</div>
          <div className="compare-row"><span>价格</span>{items.map((item) => <b key={item.board.id}>{item.board.priceInfo ? `¥${item.board.priceInfo.amount}` : catalogMode === "demo" ? `¥${item.board.price}` : "待核验"}</b>)}</div>
        </div>
      </section>

      <section className="feedback-box">
        <div><span className="eyebrow dark">HELP US LEARN</span><h2>这次推荐对你有帮助吗？</h2><p>你的匿名反馈会帮助我们校准规则，不会被用来推断身份。</p></div>
        {feedback === "done" ? <strong className="thanks">已收到，谢谢你的反馈。</strong> : (
          <div className="rating-buttons" aria-label="推荐评分">
            {[1, 2, 3, 4, 5].map((rating) => <button key={rating} disabled={feedback === "sending"} onClick={() => sendFeedback(rating)}>{rating}<small>{rating === 1 ? "不准" : rating === 5 ? "很准" : ""}</small></button>)}
          </div>
        )}
      </section>

      <p className="demo-note">当前商品与价格为功能演示数据，上线前应接入品牌官网及授权店铺数据。本工具提供选购参考，不替代现场试滑与专业雪具店调整。</p>
    </main>
  );
}

export default function RecommendationApp() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [results, setResults] = useState<Recommendation[] | null>(null);
  const [errors, setErrors] = useState<ProfileValidationErrors>({});
  const [catalogMode, setCatalogMode] = useState<"demo" | "database">("demo");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const progress = ((step + 1) / steps.length) * 100;
  const shoe = useMemo(() => estimateMondo(profile), [profile]);

  function patchProfile(patch: Partial<Profile>) {
    setProfile((current) => ({ ...current, ...patch }));
    const changedFields = Object.keys(patch) as Array<keyof Profile>;
    setErrors((current) => {
      const next = { ...current };
      changedFields.forEach((field) => {
        if (field === "shoeMode") delete next.shoeValue;
        if (field in next) delete next[field as ProfileField];
      });
      return next;
    });
  }

  async function next(event: FormEvent) {
    event.preventDefault();
    const allErrors = validateProfile(profile);
    const currentErrors = stepFields[step].reduce<ProfileValidationErrors>((found, field) => {
      if (allErrors[field]) found[field] = allErrors[field];
      return found;
    }, {});
    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});
    if (step < steps.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setSubmitting(true);
      setSubmitError("");
      try {
        const response = await fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "推荐服务暂时不可用");
        setCatalogMode(data.catalogMode);
        setResults(data.recommendations);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (reason) {
        setSubmitError(reason instanceof Error ? reason.message : "推荐服务暂时不可用");
      } finally {
        setSubmitting(false);
      }
    }
  }

  function restart() {
    setResults(null);
    setStarted(true);
    setStep(0);
    setErrors({});
    setSubmitError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (results) return <Results profile={profile} items={results} catalogMode={catalogMode} onRestart={restart} />;

  if (!started) {
    return (
      <main className="landing">
        <nav className="landing-nav">
          <a className="brand" href="#top"><span>雪</span><b>BOARDWISE</b><small>单板推荐实验室</small></a>
          <div><a href="#how">如何推荐</a><a href="#data">数据说明</a><button onClick={() => setStarted(true)}>开始选板</button></div>
        </nav>
        <section className="landing-hero" id="top">
          <div className="hero-copy">
            <span className="eyebrow">SMART SNOWBOARD MATCHING · 01</span>
            <h1>不是挑一块板，<br />是找到你的<span>下一条线。</span></h1>
            <p>告诉我们你的身体条件、技术能力和预算。规则引擎先做安全筛选，AI 再把复杂参数翻译成真正有用的选择。</p>
            <div className="hero-actions"><button className="primary-button" onClick={() => setStarted(true)}>开始 2 分钟选板 <b>→</b></button><span>无需注册 · 免费体验</span></div>
          </div>
          <div className="hero-art" aria-label="抽象雪山与单板轨迹">
            <div className="sun-disc" />
            <div className="mountain far" /><div className="mountain near" />
            <div className="board-orbit"><i /><span>YOUR<br />LINE</span></div>
            <div className="art-stat"><b>3</b><span>个推荐结果<br />每个都有理由</span></div>
          </div>
        </section>
        <section className="trust-strip"><span>体重与尺码硬过滤</span><span>日常鞋码可估算</span><span>AI 不编造参数</span><span>结果可解释</span></section>
        <section className="how-section" id="how">
          <div className="section-heading"><span className="eyebrow">HOW IT WORKS</span><h2>先算清楚，<br />再讲明白。</h2></div>
          <div className="how-grid">
            <article><b>01</b><h3>建立你的滑行画像</h3><p>用身体条件、真实能力和目标玩法代替模糊的“新手板”标签。</p></article>
            <article><b>02</b><h3>执行硬约束与排序</h3><p>先过滤体重、板腰与预算，再计算水平、地形和成长空间。</p></article>
            <article><b>03</b><h3>AI 解释选择差异</h3><p>把拱形、软硬度和板型差异翻译成你能感受到的滑行体验。</p></article>
          </div>
        </section>
        <section className="data-section" id="data"><span>当前阶段</span><strong>功能演示数据</strong><p>推荐逻辑已经可用；商品参数与参考价将在上线前通过品牌官网和授权店铺数据管线持续更新。</p><button onClick={() => setStarted(true)}>用演示目录试一次 ↗</button></section>
      </main>
    );
  }

  return (
    <main className="quiz-shell">
      <header className="quiz-header">
        <button className="brand-button" onClick={() => setStarted(false)}><span>雪</span> BOARDWISE</button>
        <div className="progress-copy"><span>STEP 0{step + 1} / 0{steps.length}</span><b>{steps[step]}</b></div>
        <button className="close-button" onClick={() => setStarted(false)} aria-label="退出问卷">×</button>
      </header>
      <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>

      <form className="quiz-content" onSubmit={next} noValidate>
        {step === 0 && (
          <section className="question-section">
            <span className="eyebrow dark">BASIC FIT</span>
            <h1>先从最诚实的数字开始。</h1>
            <p className="question-lead">体重决定长度区间，脚长决定板腰是否合适。身高只作为辅助参考。</p>
            <div className="number-grid">
              <label className={errors.height ? "field-invalid" : ""}><span>身高</span><div><input type="number" min={PROFILE_LIMITS.height.min} max={PROFILE_LIMITS.height.max} value={profile.height} onChange={(e) => patchProfile({ height: Number(e.target.value) })} aria-invalid={Boolean(errors.height)} aria-describedby={errors.height ? "height-error" : undefined} required /><b>cm</b></div>{errors.height && <small className="field-error" id="height-error" role="alert">{errors.height}</small>}</label>
              <label className={errors.weight ? "field-invalid" : ""}><span>体重</span><div><input type="number" min={PROFILE_LIMITS.weight.min} max={PROFILE_LIMITS.weight.max} value={profile.weight} onChange={(e) => patchProfile({ weight: Number(e.target.value) })} aria-invalid={Boolean(errors.weight)} aria-describedby={errors.weight ? "weight-error" : undefined} required /><b>kg</b></div>{errors.weight && <small className="field-error" id="weight-error" role="alert">{errors.weight}</small>}</label>
            </div>
            <fieldset>
              <legend>你知道自己的哪种尺码？</legend>
              <div className="segmented">
                {([['foot', '脚长 cm'], ['mondo', '雪鞋 Mondo'], ['daily-eu', '日常鞋 EU 码']] as [ShoeMode, string][]).map(([mode, label]) => <button type="button" key={mode} className={profile.shoeMode === mode ? "active" : ""} onClick={() => patchProfile({ shoeMode: mode, shoeValue: mode === "daily-eu" ? 41 : 26 })}>{label}</button>)}
              </div>
              <label className={`shoe-input ${errors.shoeValue ? "field-invalid" : ""}`}><span>{profile.shoeMode === "daily-eu" ? "日常运动鞋欧码" : profile.shoeMode === "foot" ? "赤脚脚长" : "雪鞋 Mondo 尺码"}</span><div><input type="number" min={PROFILE_LIMITS[profile.shoeMode].min} max={PROFILE_LIMITS[profile.shoeMode].max} step={PROFILE_LIMITS[profile.shoeMode].step} value={profile.shoeValue} onChange={(e) => patchProfile({ shoeValue: Number(e.target.value) })} aria-invalid={Boolean(errors.shoeValue)} aria-describedby={errors.shoeValue ? "shoe-error" : undefined} required /><b>{profile.shoeMode === "daily-eu" ? "EU" : "cm"}</b></div>{errors.shoeValue && <small className="field-error" id="shoe-error" role="alert">{errors.shoeValue}</small>}</label>
              {profile.shoeMode === "daily-eu" && Number.isFinite(shoe.mondo) && <p className="inline-tip">估算为 Mondo {shoe.mondo}。日常鞋码存在品牌差异，临界板宽会要求补测脚长。</p>}
              {profile.shoeMode === "foot" && <p className="inline-tip">测量方法：脚跟靠墙站立，从墙面量到最长脚趾，左右脚取较大值。</p>}
            </fieldset>
          </section>
        )}

        {step === 1 && (
          <section className="question-section">
            <span className="eyebrow dark">RIDING LEVEL</span>
            <h1>不看证书，看你现在能做什么。</h1>
            <p className="question-lead">真实能力比“初级、中级”的自我标签更可靠。</p>
            <div className="option-grid vertical">
              <OptionCard active={profile.level === "first"} title="第一次买板 / 刚开始" copy="仍在熟悉推坡、落叶飘和基本站姿" onClick={() => patchProfile({ level: "first", canLinkTurns: false })} />
              <OptionCard active={profile.level === "beginner"} title="可以连续换刃" copy="能在初中级道控制速度并完成连续转弯" onClick={() => patchProfile({ level: "beginner", canLinkTurns: true })} />
              <OptionCard active={profile.level === "intermediate"} title="稳定滑行，准备进阶" copy="多数雪道可控，开始关注刻滑、平花或复杂地形" onClick={() => patchProfile({ level: "intermediate", canLinkTurns: true })} />
            </div>
            <label className="range-field"><span>累计滑雪天数 <b>{profile.snowDays} 天</b></span><input type="range" min={PROFILE_LIMITS.snowDays.min} max={PROFILE_LIMITS.snowDays.max} value={profile.snowDays} onChange={(e) => patchProfile({ snowDays: Number(e.target.value) })} aria-invalid={Boolean(errors.snowDays)} />{errors.snowDays && <small className="field-error" role="alert">{errors.snowDays}</small>}</label>
          </section>
        )}

        {step === 2 && (
          <section className="question-section">
            <span className="eyebrow dark">YOUR TERRAIN</span>
            <h1>你最想把哪种滑法变得更好？</h1>
            <p className="question-lead">选择未来一个雪季最主要的玩法，而不是“偶尔也想试试”。</p>
            <div className="option-grid two-col">
              {(Object.entries(styleLabels) as [Style, { title: string; copy: string }][]).map(([style, value]) => <OptionCard key={style} active={profile.style === style} title={value.title} copy={value.copy} onClick={() => patchProfile({ style })} />)}
            </div>
            <fieldset><legend>你更喜欢哪种脚感？</legend><div className="segmented feelings"><button type="button" className={profile.feel === "easy" ? "active" : ""} onClick={() => patchProfile({ feel: "easy" })}>轻松容错</button><button type="button" className={profile.feel === "balanced" ? "active" : ""} onClick={() => patchProfile({ feel: "balanced" })}>均衡万用</button><button type="button" className={profile.feel === "stable" ? "active" : ""} onClick={() => patchProfile({ feel: "stable" })}>稳定支撑</button></div></fieldset>
          </section>
        )}

        {step === 3 && (
          <section className="question-section">
            <span className="eyebrow dark">BUDGET & GROWTH</span>
            <h1>最后，确定你的选择边界。</h1>
            <p className="question-lead">预算用于筛选，而不是让高价板自动获得更高分。</p>
            <label className={`budget-field ${errors.budget ? "field-invalid" : ""}`}><span>单板预算上限（最高 ¥{PROFILE_LIMITS.budget.max.toLocaleString("zh-CN")}）</span><div><b>¥</b><input type="number" min={PROFILE_LIMITS.budget.min} max={PROFILE_LIMITS.budget.max} step={PROFILE_LIMITS.budget.step} value={profile.budget} onChange={(e) => patchProfile({ budget: Number(e.target.value) })} aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? "budget-error" : undefined} required /></div>{errors.budget && <small className="field-error" id="budget-error" role="alert">{errors.budget}</small>}</label>
            <label className="check-row"><input type="checkbox" checked={profile.acceptPastSeason} onChange={(e) => patchProfile({ acceptPastSeason: e.target.checked })} /><span><strong>接受上季款与折扣款</strong><small>参数合适时，旧年份通常能提供更好的价格。</small></span></label>
            <div className="profile-summary"><span>你的推荐画像</span><b>{profile.weight} kg · {profile.level === "intermediate" ? "中级进阶" : profile.level === "beginner" ? "初级换刃" : "首次购板"} · {styleLabels[profile.style].title}</b><small>{profile.shoeMode === "daily-eu" ? `日常 EU ${profile.shoeValue}（板宽待复核）` : `脚长 / Mondo ${profile.shoeValue} cm`}</small></div>
          </section>
        )}

        <footer className="quiz-footer">
          <button type="button" className="back-button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>← 上一步</button>
          <div className="submit-area">{submitError && <small className="field-error" role="alert">{submitError}</small>}<button className="primary-button" type="submit" disabled={submitting}>{submitting ? "正在生成…" : step === steps.length - 1 ? "生成推荐" : "继续"}<b>→</b></button></div>
        </footer>
      </form>
    </main>
  );
}
