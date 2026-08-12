/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  DIFY_API_KEY?: string;
  DIFY_API_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
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
