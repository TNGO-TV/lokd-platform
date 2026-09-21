import { env } from "cloudflare:workers";
import { PilotAccessError, pilotStage, requirePilotApiRole, requireSameOriginJson, type PilotPrincipal } from "../../lib/pilot-runtime";

import { readRequestText, RequestBodyError } from "../../lib/request-body";

export const dynamic = "force-dynamic";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/csv",
  "text/plain",
]);

class EvidenceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function response(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "x-lokd-verified-email",
    },
  });
}

function errorResponse(cause: unknown) {
  const error = cause instanceof EvidenceError || cause instanceof PilotAccessError || cause instanceof RequestBodyError
    ? cause
    : new EvidenceError("The evidence operation could not be completed.", 500);
  return response({ error: error.message }, error.status);
}

function backend() {
  if (!env.DB || !env.BUCKET) throw new EvidenceError("The private evidence backend is unavailable.", 503);
  return { db: env.DB, bucket: env.BUCKET };
}

function requirePrivateRuntime() {
  const stage = pilotStage();
  if (stage === "demo") throw new EvidenceError("Evidence uploads are disabled in the public demo.", 423);
  return stage;
}

// Finance/compliance are labels without supported assignments in PilotPrincipal.
// Deny them until explicit grants exist; owner does not imply an unsupported class.
function requireArtifactAccess(actor: PilotPrincipal, accessClass: string) {
  if (accessClass === "operations" || (accessClass === "owner" && actor.owner)) return;
  throw new EvidenceError("This account cannot access that evidence class.", 403);
}

function decodeBase64(value: string) {
  if (!value || value.length > 7_200_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new EvidenceError("The evidence content is not valid bounded base64.");
  }
  try {
    const binary = atob(value);
    if (binary.length < 1 || binary.length > 5_000_000) throw new EvidenceError("Evidence files must be between 1 byte and 5 MB.", 413);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (cause) {
    if (cause instanceof EvidenceError) throw cause;
    throw new EvidenceError("The evidence content is not valid base64.");
  }
}

async function hash(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  let storageKey: string | null = null;
  try {
    requireSameOriginJson(request);
    const actor = requirePilotApiRole(request, "operations");
    const stage = requirePrivateRuntime();
    const { db, bucket } = backend();
    const raw = await readRequestText(request, 7_500_000);
    let body: { kind?: unknown; mimeType?: unknown; retentionClass?: unknown; accessClass?: unknown; contentBase64?: unknown };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      throw new EvidenceError("The request body is not valid JSON.");
    }
    const kind = typeof body.kind === "string" ? body.kind.trim().toLowerCase() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
    const retentionClass = typeof body.retentionClass === "string" ? body.retentionClass.trim().toLowerCase() : "";
    const accessClass = typeof body.accessClass === "string" ? body.accessClass.trim().toLowerCase() : "";
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(kind)) throw new EvidenceError("Choose a valid evidence kind.");
    if (!allowedMimeTypes.has(mimeType)) throw new EvidenceError("That evidence file type is not accepted.", 415);
    if (!new Set(["operational_7y", "employment_7y", "financial_7y", "incident_10y", "temporary_90d"]).has(retentionClass)) {
      throw new EvidenceError("Choose an approved retention class.");
    }
    if (!new Set(["operations", "finance", "compliance", "owner"]).has(accessClass)) throw new EvidenceError("Choose an approved access class.");
    if (typeof body.contentBase64 !== "string") throw new EvidenceError("Evidence content is required.");
    requireArtifactAccess(actor, accessClass);
    const bytes = decodeBase64(body.contentBase64);
    const contentHash = await hash(bytes);
    const artifactId = `ART-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const dataEnvironment = stage === "production" ? "production" : "prelaunch";
    const integrityState = "user_submitted";
    storageKey = `${dataEnvironment}/${kind}/${now.slice(0, 7)}/${crypto.randomUUID()}`;
    await bucket.put(storageKey, bytes, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { artifactId, contentHash, accessClass, retentionClass },
    });
    await db.batch([
      db.prepare(`INSERT INTO document_artifacts
        (id, kind, storage_reference, content_hash, mime_type, size_bytes, retention_class,
         access_class, status, environment, integrity_state, created_at, verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stored_unverified', ?, ?, ?, NULL)`)
        .bind(artifactId, kind, `BUCKET:${storageKey}`, contentHash, mimeType, bytes.byteLength,
          retentionClass, accessClass, dataEnvironment, integrityState, now),
      db.prepare(`INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'evidence_stored', 'document_artifact', ?, ?, ?)`)
        .bind(`AUD-${crypto.randomUUID()}`, actor.email, artifactId,
          `Stored ${kind} evidence (${bytes.byteLength} bytes, SHA-256 ${contentHash}).`, now),
    ]);
    return response({ artifact: { id: artifactId, kind, mimeType, sizeBytes: bytes.byteLength, contentHash, status: "stored_unverified" } }, 201);
  } catch (cause) {
    if (storageKey && env.BUCKET) {
      try {
        await env.BUCKET.delete(storageKey);
      } catch {
        // The database remains authoritative; an orphan sweep can remove a failed write later.
      }
    }
    return errorResponse(cause);
  }
}

export async function GET(request: Request) {
  try {
    const actor = requirePilotApiRole(request, "operations");
    const stage = requirePrivateRuntime();
    const { db, bucket } = backend();
    const url = new URL(request.url);
    const artifactId = url.searchParams.get("id")?.trim() ?? "";
    if (!/^ART-[0-9a-f-]{36}$/i.test(artifactId)) throw new EvidenceError("Choose a valid evidence artifact.");
    const dataEnvironment = stage === "production" ? "production" : "prelaunch";
    const artifact = await db.prepare(`SELECT id, kind, storage_reference AS storageReference,
      content_hash AS contentHash, mime_type AS mimeType, size_bytes AS sizeBytes,
      retention_class AS retentionClass, access_class AS accessClass, status,
      created_at AS createdAt, verified_at AS verifiedAt
      FROM document_artifacts WHERE id = ? AND environment = ?`).bind(artifactId, dataEnvironment).first<{
        id: string; kind: string; storageReference: string; contentHash: string; mimeType: string;
        sizeBytes: number; retentionClass: string; accessClass: string; status: string;
        createdAt: string; verifiedAt: string | null;
      }>();
    if (!artifact || !artifact.storageReference.startsWith("BUCKET:")) throw new EvidenceError("That evidence artifact was not found.", 404);
    requireArtifactAccess(actor, artifact.accessClass);
    if (url.searchParams.get("download") !== "1") return response({ artifact: { ...artifact, storageReference: undefined } });
    const object = await bucket.get(artifact.storageReference.slice("BUCKET:".length));
    if (!object) throw new EvidenceError("The evidence object is unavailable.", 503);
    return new Response(object.body, {
      headers: {
        "cache-control": "no-store, private",
        "content-type": artifact.mimeType,
        "content-length": String(artifact.sizeBytes),
        "content-disposition": `attachment; filename="${artifact.id}"`,
        "x-content-type-options": "nosniff",
        "x-evidence-sha256": artifact.contentHash,
        vary: "x-lokd-verified-email",
      },
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOriginJson(request);
    const actor = requirePilotApiRole(request, "operations");
    const stage = requirePrivateRuntime();
    const { db, bucket } = backend();
    const raw = await readRequestText(request, 2_000);
    let body: { artifactId?: unknown; expectedHash?: unknown };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      throw new EvidenceError("The request body is not valid JSON.");
    }
    const artifactId = typeof body.artifactId === "string" ? body.artifactId.trim() : "";
    const expectedHash = typeof body.expectedHash === "string" ? body.expectedHash.trim().toLowerCase() : "";
    if (!/^ART-[0-9a-f-]{36}$/i.test(artifactId) || !/^[0-9a-f]{64}$/.test(expectedHash)) {
      throw new EvidenceError("Choose a valid artifact and expected SHA-256 hash.");
    }
    const dataEnvironment = stage === "production" ? "production" : "prelaunch";
    const artifact = await db.prepare(`SELECT artifact.id, artifact.storage_reference AS storageReference,
      artifact.content_hash AS contentHash, artifact.size_bytes AS sizeBytes, artifact.status, artifact.access_class AS accessClass,
      (SELECT audit.actor_id FROM audit_events audit
        WHERE audit.entity_type = 'document_artifact' AND audit.entity_id = artifact.id
          AND audit.event_type = 'evidence_stored' ORDER BY audit.created_at LIMIT 1) AS storedBy
      FROM document_artifacts artifact WHERE artifact.id = ? AND artifact.environment = ?`)
      .bind(artifactId, dataEnvironment).first<{
        id: string; storageReference: string; contentHash: string; sizeBytes: number;
        status: string; storedBy: string | null; accessClass: string;
      }>();
    if (!artifact || !artifact.storageReference.startsWith("BUCKET:")) throw new EvidenceError("That evidence artifact was not found.", 404);
    requireArtifactAccess(actor, artifact.accessClass);
    if (artifact.status !== "stored_unverified") throw new EvidenceError("That evidence artifact has already left the verification queue.", 409);
    if (artifact.contentHash !== expectedHash) throw new EvidenceError("The expected evidence hash does not match the stored record.", 409);
    if (artifact.storedBy === actor.email) throw new EvidenceError("A second authorised operator must verify this evidence.", 409);
    const object = await bucket.head(artifact.storageReference.slice("BUCKET:".length));
    if (!object || object.size !== artifact.sizeBytes || object.customMetadata?.contentHash !== artifact.contentHash) {
      throw new EvidenceError("The private evidence object failed its integrity check.", 409);
    }
    const now = new Date().toISOString();
    const verifiedIntegrityState = stage === "production" ? "production_verified" : "verified";
    await db.batch([
      db.prepare(`UPDATE document_artifacts SET status = 'verified', integrity_state = ?, verified_at = ?
        WHERE id = ? AND status = 'stored_unverified' AND content_hash = ? AND environment = ?`)
        .bind(verifiedIntegrityState, now, artifact.id, artifact.contentHash, dataEnvironment),
      db.prepare(`INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        SELECT ?, 'operations', ?, 'evidence_verified', 'document_artifact', id, ?, ?
        FROM document_artifacts WHERE id = ? AND status = 'verified' AND verified_at = ?`)
        .bind(`AUD-${crypto.randomUUID()}`, actor.email,
          `Verified the R2 object size and SHA-256 ${artifact.contentHash} under second-operator control.`,
          now, artifact.id, now),
    ]);
    return response({ artifact: { id: artifact.id, status: "verified", contentHash: artifact.contentHash, verifiedAt: now } });
  } catch (cause) {
    return errorResponse(cause);
  }
}
