/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runDueAssignmentRevalidations } from "../app/lib/assignment-activation-server";
import { runPlatformMaintenance } from "../app/lib/platform-jobs";
import { authenticateClerkRequest, type ClerkEnv } from "./clerk-auth";

interface Env extends ClerkEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  LOKD_APP_STAGE?: string;
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

interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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

    try {
      const auth = await authenticateClerkRequest(request, env);
      if (auth.response) return auth.response;
      const response = await handler.fetch(auth.request, env, ctx);
      const forwarded = new Response(response.body, response);
      auth.headers.forEach((value, key) => forwarded.headers.append(key, value));
      if (auth.request.headers.has("x-lokd-verified-email") || url.pathname.startsWith("/sign-")) {
        forwarded.headers.set("cache-control", "private, no-store");
      }
      return forwarded;
    } catch {
      return new Response("Sign-in is temporarily unavailable. Please try again.", {
        status: 503, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const configuredStage = env.LOKD_APP_STAGE?.trim().toLowerCase();
    const environment = configuredStage === "demo" ? "demo" : configuredStage === "production" ? "production" : "prelaunch";
    const integrityState = environment === "demo" ? "synthetic" : environment === "production" ? "production_verified" : "user_submitted";
    ctx.waitUntil(runPlatformMaintenance(env.DB, {
      actorId: "system:scheduled-maintenance",
      trigger: "scheduled",
      evidenceStoreBound: Boolean(env.BUCKET),
      environment,
      integrityState,
    }).then(() => undefined));
    ctx.waitUntil(runDueAssignmentRevalidations(env.DB, "system:scheduled-revalidation").then(() => undefined));
  },
};

export default worker;
