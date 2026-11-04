import { secureRequest, secureResponse } from "../app/lib/security-headers";
import { ownerBackup, type BackupEnv } from "./owner-backup";
/** Production Cloudflare Worker entry point. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runDueAssignmentRevalidations } from "../app/lib/assignment-activation-server";
import { runDataRetention, runPlatformMaintenance } from "../app/lib/platform-jobs";
import { runOperationalDelivery } from "../app/lib/operational-delivery";
import { deliverClientNotifications } from "../app/lib/quote-notifications";
import type { OperationalRuntime } from "../app/lib/operational-provider";
import { authenticateRequest } from "./identity";
import { recordVerifiedIdentity } from "../app/lib/identity-directory";

interface Env extends BackupEnv, OperationalRuntime {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const backup = await ownerBackup(request, env);
    if (backup) return backup;
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

    // Infrastructure probes must remain usable when browser authentication fails.
    if (url.pathname === '/api/health/live' || url.pathname === '/api/health/ready') return await handler.fetch(request, env, ctx);
    // Provider authentication is HMAC, independent of browser sessions.
    if (url.pathname === '/api/paystack/booking/webhook' || url.pathname === '/api/paystack/transfers/live/webhook') return await handler.fetch(request, env, ctx);

    let auth;
    try {
      auth = await authenticateRequest(request);
    } catch {
      return new Response("Sign-in is temporarily unavailable. Please try again.", {
        status: 503, headers: { "cache-control": "private, no-store", "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (auth.response) return auth.response;
    if (env.DB && auth.request.headers.has("x-lokd-verified-user-id")) {
      ctx.waitUntil(recordVerifiedIdentity(env.DB, auth.request.headers).catch(() => undefined));
    }
    const response = await handler.fetch(auth.request, env, ctx);
    const forwarded = new Response(response.body, response);
    auth.headers.forEach((value, key) => forwarded.headers.append(key, value));
    if (auth.request.headers.has("x-lokd-verified-email") || url.pathname.startsWith("/sign-")) {
      forwarded.headers.set("cache-control", "private, no-store");
    }
    return forwarded;
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const secured = secureRequest(request);
    try { return secureResponse(await worker.handle(secured.request, env, ctx), secured.policy, secured.request); }
    catch { return secureResponse(new Response("Service temporarily unavailable.", {status: 503, headers: {"content-type": "text/plain; charset=utf-8", "cache-control": "no-store"}}), secured.policy); }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runPlatformMaintenance(env.DB, {
      actorId: "system:scheduled-maintenance",
      trigger: "scheduled",
      evidenceStoreBound: Boolean(env.BUCKET),
    }).then(() => undefined));
    ctx.waitUntil(runDataRetention(env.DB).then(() => undefined));
    ctx.waitUntil(runDueAssignmentRevalidations(env.DB, "system:scheduled-revalidation").then(() => undefined));
    ctx.waitUntil(runOperationalDelivery(env.DB, env).then(() => undefined));
    // Client emails queued by bookings, quotes, agreements and billing send and retry here.
    ctx.waitUntil(deliverClientNotifications(env.DB, env).then(() => undefined));
  },
};

export default worker;
