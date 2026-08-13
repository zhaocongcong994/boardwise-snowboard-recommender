/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { loadPublishedCatalog, validateCatalogSubmission, type CatalogSubmission } from "../lib/catalog";
import { boards, recommend, validateProfile, type Profile } from "../lib/recommendation";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  DIFY_API_KEY?: string;
  DIFY_API_URL?: string;
  ADMIN_EMAILS?: string;
  LOCAL_ADMIN_EMAIL?: string;
  CATALOG_MODE?: "demo" | "database";
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type AuthenticatedUser = { id: string; email: string };

function authenticatedUser(request: Request, env: Env): AuthenticatedUser | null {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLocaleLowerCase("en-US");
  if (id && email) return { id, email };
  const hostname = new URL(request.url).hostname;
  const localEmail = env.LOCAL_ADMIN_EMAIL?.trim().toLocaleLowerCase("en-US");
  return localEmail && (hostname === "localhost" || hostname === "127.0.0.1")
    ? { id: "local-boardwise-admin", email: localEmail }
    : null;
}

function requireAdmin(request: Request, env: Env): AuthenticatedUser | Response {
  const user = authenticatedUser(request, env);
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const allowed = (env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLocaleLowerCase("en-US")).filter(Boolean);
  if (!allowed.includes(user.email)) return Response.json({ error: "没有目录审核权限" }, { status: 403 });
  return user;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function priceSourceId(boardId: string, url: string) {
  let hash = 2166136261;
  for (const char of url) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${boardId}-price-${(hash >>> 0).toString(16)}`;
}

async function publishChange(db: D1Database, change: Record<string, unknown>, user: AuthenticatedUser, note: string | null) {
  const submission = JSON.parse(String(change.payload_json)) as CatalogSubmission;
  const errors = validateCatalogSubmission(submission);
  if (errors.length) return Response.json({ error: "数据未通过发布校验", details: errors }, { status: 400 });

  const { board, specificationSource, price } = submission;
  const now = new Date().toISOString();
  const statements = [
    db.prepare(`INSERT INTO snowboard_models (id, brand, model, season, audience, levels_json, styles_json, flex, profile, shape, color, status, published_at, updated_at)
      VALUES (?, ?, ?, ?, 'adult', ?, ?, ?, ?, ?, ?, 'published', ?, ?)
      ON CONFLICT(id) DO UPDATE SET brand=excluded.brand, model=excluded.model, season=excluded.season, levels_json=excluded.levels_json,
      styles_json=excluded.styles_json, flex=excluded.flex, profile=excluded.profile, shape=excluded.shape, color=excluded.color, status='published', updated_at=excluded.updated_at`)
      .bind(board.id, board.brand, board.model, board.year, JSON.stringify(board.level), JSON.stringify(board.styles), board.flex, board.profile, board.shape, board.color, now, now),
    db.prepare("DELETE FROM snowboard_variants WHERE board_id = ?").bind(board.id),
    ...board.variants.map((variant) => db.prepare("INSERT INTO snowboard_variants (id, board_id, size, size_label, waist, weight_min, weight_max) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(`${board.id}-${variant.size}-${variant.waist}`, board.id, variant.size, variant.sizeLabel ?? String(variant.size), variant.waist, variant.weightMin, variant.weightMax)),
    db.prepare(`INSERT INTO catalog_sources (id, board_id, source_type, source_name, url, verified_at, content_hash, is_official)
      VALUES (?, ?, 'brand_official', ?, ?, ?, ?, 1)
      ON CONFLICT(board_id, url) DO UPDATE SET source_name=excluded.source_name, verified_at=excluded.verified_at, content_hash=excluded.content_hash`)
      .bind(`${board.id}-spec`, board.id, specificationSource.sourceName, specificationSource.sourceUrl, specificationSource.verifiedAt, specificationSource.contentHash ?? null),
  ];

  if (price) {
    const sourceId = priceSourceId(board.id, price.sourceUrl);
    const expiresAt = new Date(new Date(price.observedAt).getTime() + 14 * 86400000).toISOString();
    statements.push(
      db.prepare(`INSERT INTO catalog_sources (id, board_id, source_type, source_name, url, verified_at, is_official)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(board_id, url) DO UPDATE SET source_type=excluded.source_type, source_name=excluded.source_name, verified_at=excluded.verified_at, is_official=excluded.is_official`)
        .bind(sourceId, board.id, price.sourceType, price.sourceName, price.sourceUrl, price.observedAt, price.sourceType !== "authorized_retailer" ? 1 : 0),
      db.prepare("INSERT INTO price_snapshots (id, board_id, source_id, amount, currency, availability, observed_at, expires_at) VALUES (?, ?, ?, ?, 'CNY', 'in_stock', ?, ?)")
        .bind(crypto.randomUUID(), board.id, sourceId, price.amount, price.observedAt, expiresAt),
    );
  }

  statements.push(
    db.prepare("UPDATE catalog_changes SET status='approved', reviewed_at=?, reviewed_by=?, review_note=? WHERE id=? AND status='pending'").bind(now, user.email, note, change.id),
    db.prepare("INSERT INTO catalog_review_events (id, change_id, action, reviewer_id, reviewer_email, note) VALUES (?, ?, 'approved', ?, ?, ?)")
      .bind(crypto.randomUUID(), change.id, user.id, user.email, note),
  );
  await db.batch(statements);
  return Response.json({ ok: true });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/recommendations" && request.method === "POST") {
      try {
        const profile = await request.json() as Profile;
        const errors = validateProfile(profile);
        if (Object.keys(errors).length) return Response.json({ error: "用户画像无效", details: errors }, { status: 400 });
        let catalog = boards;
        let catalogMode: "demo" | "database" = "demo";
        try {
          const published = await loadPublishedCatalog(env.DB);
          if (published.length) { catalog = published; catalogMode = "database"; }
          else if (env.CATALOG_MODE === "database") return Response.json({ error: "正式目录尚无已发布数据" }, { status: 503 });
        } catch (error) {
          if (env.CATALOG_MODE === "database") throw error;
        }
        return Response.json({ recommendations: recommend(profile, catalog), catalogMode, generatedAt: new Date().toISOString() });
      } catch {
        return Response.json({ error: "推荐服务暂时不可用" }, { status: 503 });
      }
    }

    if (url.pathname === "/api/admin/catalog/changes" && request.method === "GET") {
      const user = requireAdmin(request, env);
      if (user instanceof Response) return user;
      const status = url.searchParams.get("status") === "approved" || url.searchParams.get("status") === "rejected" ? url.searchParams.get("status")! : "pending";
      const changes = await env.DB.prepare("SELECT * FROM catalog_changes WHERE status = ? ORDER BY collected_at DESC LIMIT 200").bind(status).all();
      return Response.json({ changes: changes.results });
    }

    if (url.pathname === "/api/admin/catalog/changes" && request.method === "POST") {
      const user = requireAdmin(request, env);
      if (user instanceof Response) return user;
      const submission = await request.json() as CatalogSubmission;
      const errors = validateCatalogSubmission(submission);
      if (errors.length) return Response.json({ error: "采集数据无效", details: errors }, { status: 400 });
      const payloadJson = JSON.stringify(submission);
      const contentHash = await sha256(payloadJson);
      const identityKey = `${submission.board.brand.trim().toLocaleLowerCase("en-US")}::${submission.board.model.trim().toLocaleLowerCase("en-US")}::${submission.board.year}::adult`;
      await env.DB.prepare("INSERT OR IGNORE INTO catalog_changes (id, identity_key, change_type, payload_json, source_url, content_hash, status, collected_at) VALUES (?, ?, 'upsert', ?, ?, ?, 'pending', ?)")
        .bind(crypto.randomUUID(), identityKey, payloadJson, submission.specificationSource.sourceUrl, contentHash, new Date().toISOString()).run();
      return Response.json({ ok: true, contentHash }, { status: 201 });
    }

    const reviewMatch = url.pathname.match(/^\/api\/admin\/catalog\/changes\/([^/]+)\/review$/);
    if (reviewMatch && request.method === "POST") {
      const user = requireAdmin(request, env);
      if (user instanceof Response) return user;
      const body = await request.json() as { action?: "approve" | "reject"; note?: string };
      if (body.action !== "approve" && body.action !== "reject") return Response.json({ error: "审核动作无效" }, { status: 400 });
      const change = await env.DB.prepare("SELECT * FROM catalog_changes WHERE id = ? AND status = 'pending'").bind(reviewMatch[1]).first<Record<string, unknown>>();
      if (!change) return Response.json({ error: "待审核变更不存在或已处理" }, { status: 404 });
      if (body.action === "approve") return publishChange(env.DB, change, user, body.note?.trim() || null);
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare("UPDATE catalog_changes SET status='rejected', reviewed_at=?, reviewed_by=?, review_note=? WHERE id=? AND status='pending'").bind(now, user.email, body.note?.trim() || null, change.id),
        env.DB.prepare("INSERT INTO catalog_review_events (id, change_id, action, reviewer_id, reviewer_email, note) VALUES (?, ?, 'rejected', ?, ?, ?)")
          .bind(crypto.randomUUID(), change.id, user.id, user.email, body.note?.trim() || null),
      ]);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      try {
        const body = await request.json() as { rating?: number; selectedBoard?: string; profile?: unknown };
        if (!Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5) {
          return Response.json({ error: "评分应为 1–5" }, { status: 400 });
        }
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS recommendation_feedback (
          id TEXT PRIMARY KEY,
          rating INTEGER NOT NULL,
          selected_board TEXT,
          profile_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`).run();
        await env.DB.prepare("INSERT INTO recommendation_feedback (id, rating, selected_board, profile_json) VALUES (?, ?, ?, ?)")
          .bind(crypto.randomUUID(), body.rating, body.selectedBoard ?? null, JSON.stringify(body.profile ?? {})).run();
        return Response.json({ ok: true }, { status: 201 });
      } catch {
        return Response.json({ error: "反馈暂时无法保存" }, { status: 500 });
      }
    }

    if (url.pathname === "/api/ai-explain" && request.method === "POST") {
      if (!env.DIFY_API_KEY) return Response.json({ error: "AI workflow is not configured" }, { status: 503 });
      try {
        const payload = await request.json();
        const response = await fetch(env.DIFY_API_URL ?? "https://api.dify.ai/v1/workflows/run", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.DIFY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: { recommendation_context: JSON.stringify(payload) }, response_mode: "blocking", user: "boardwise-web" }),
        });
        if (!response.ok) throw new Error("Dify request failed");
        const data = await response.json() as { data?: { outputs?: { answer?: string; result?: string } } };
        const answer = data.data?.outputs?.answer ?? data.data?.outputs?.result;
        if (!answer) throw new Error("Dify returned no answer");
        return Response.json({ answer });
      } catch {
        return Response.json({ error: "AI explanation unavailable" }, { status: 502 });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
