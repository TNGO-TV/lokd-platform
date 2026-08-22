import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

function response(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "cache-control": "no-store, private" } });
}

function getDb() {
  if (!env.DB) throw new Error("The pilot feedback service is unavailable.");
  return env.DB;
}

export async function GET() {
  try {
    const result = await getDb().prepare(`SELECT id, reviewer_email AS reviewerEmail, route, role,
      category, score, note, status, created_at AS createdAt FROM pilot_feedback
      ORDER BY created_at DESC LIMIT 100`).all();
    return response({ feedback: result.results ?? [] });
  } catch {
    return response({ error: "Feedback could not be loaded." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { route?: string; role?: string; category?: string; score?: number; note?: string };
    const route = (body.route ?? "/").slice(0, 160);
    const role = (body.role ?? "Reviewer").slice(0, 40);
    const category = body.category ?? "Idea";
    const note = body.note?.trim().slice(0, 2000) ?? "";
    const score = Number(body.score ?? 0);
    if (!['Bug', 'Confusing', 'Missing', 'Idea'].includes(category)) return response({ error: "Choose a feedback category." }, 400);
    if (!note) return response({ error: "Please add a short note." }, 400);
    if (score < 1 || score > 5) return response({ error: "Choose a score from 1 to 5." }, 400);
    const reviewerEmail = request.headers.get("oai-authenticated-user-email");
    const now = new Date().toISOString();
    const id = `FDB-${crypto.randomUUID()}`;
    await getDb().prepare(`INSERT INTO pilot_feedback
      (id, reviewer_email, route, role, category, score, note, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)`)
      .bind(id, reviewerEmail, route, role, category, score, note, now).run();
    return response({ ok: true, id }, 201);
  } catch {
    return response({ error: "Feedback could not be saved." }, 503);
  }
}
