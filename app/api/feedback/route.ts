import { env } from "cloudflare:workers";
import { PilotAccessError, requirePilotApiRole, requireSameOriginJson } from "../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

function response(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "cache-control": "no-store, private" } });
}

function getDb() {
  if (!env.DB) throw new Error("The pilot feedback service is unavailable.");
  return env.DB;
}

export async function GET(request: Request) {
  try {
    requirePilotApiRole(request, "operations");
    const result = await getDb().prepare(`SELECT id, reviewer_email AS reviewerEmail, route, role,
      category, score, note, status, created_at AS createdAt FROM pilot_feedback
      ORDER BY created_at DESC LIMIT 100`).all();
    return response({ feedback: result.results ?? [] });
  } catch (cause) {
    if (cause instanceof PilotAccessError) return response({ error: cause.message }, cause.status);
    return response({ error: "Feedback could not be loaded." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOriginJson(request);
    const principal = requirePilotApiRole(request, ["operations", "client", "officer", "reviewer"]);
    const raw = await request.text();
    if (raw.length > 8_192) return response({ error: "Feedback is too large." }, 413);
    const body = JSON.parse(raw) as { route?: string; category?: string; score?: number; note?: string };
    const route = typeof body.route === "string" && body.route.startsWith("/") && !body.route.startsWith("//") ? body.route.slice(0, 160) : "/";
    const role = principal.owner ? "Owner" : principal.roles.join("+").slice(0, 40);
    const category = body.category ?? "Idea";
    const note = body.note?.trim().slice(0, 2000) ?? "";
    const score = Number(body.score ?? 0);
    if (!['Bug', 'Confusing', 'Missing', 'Idea'].includes(category)) return response({ error: "Choose a feedback category." }, 400);
    if (!note) return response({ error: "Please add a short note." }, 400);
    if (score < 1 || score > 5) return response({ error: "Choose a score from 1 to 5." }, 400);
    const reviewerEmail = principal.email;
    const now = new Date().toISOString();
    const id = `FDB-${crypto.randomUUID()}`;
    await getDb().prepare(`INSERT INTO pilot_feedback
      (id, reviewer_email, route, role, category, score, note, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)`)
      .bind(id, reviewerEmail, route, role, category, score, note, now).run();
    return response({ ok: true, id }, 201);
  } catch (cause) {
    if (cause instanceof PilotAccessError) return response({ error: cause.message }, cause.status);
    return response({ error: "Feedback could not be saved." }, 503);
  }
}
