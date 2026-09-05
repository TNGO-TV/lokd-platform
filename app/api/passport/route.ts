import { env } from "cloudflare:workers";
import { liveShiftScanEnabled, PilotAccessError, requirePilotApiRole, requireSameOriginJson } from "../../lib/pilot-runtime";
import { evaluateBookingReadiness, readPublicPassport, tokenHash } from "../../lib/passport-server";

export const dynamic = "force-dynamic";

function db() {
  if (!env.DB) throw new Error("Passport verification is temporarily unavailable.");
  return env.DB;
}

function response(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: {
    "cache-control": "no-store, private",
    "x-robots-tag": "noindex, nofollow",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  } });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    const bookingId = url.searchParams.get("booking");
    const shiftId = url.searchParams.get("shift");
    const passport = await readPublicPassport(db(), token, bookingId, shiftId);
    if (!passport) return response({ error: "This LOKD Passport could not be verified." }, 404);
    return response({ passport });
  } catch {
    return response({ error: "Passport verification is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    if (!liveShiftScanEnabled()) return response({ error: "Shift arrival recording is locked until the controlled pilot is activated." }, 423);
    requireSameOriginJson(request);
    const principal = await requirePilotApiRole(request, "client");
    const raw = await request.text();
    if (raw.length > 8_192) return response({ error: "The verification request is too large." }, 413);
    const payload = JSON.parse(raw) as { token?: string; bookingId?: string; shiftId?: string };
    const token = payload.token?.trim() ?? "";
    const bookingId = payload.bookingId?.trim() ?? "";
    const shiftId = payload.shiftId?.trim() ?? "";
    if (!token || !bookingId || !shiftId) return response({ error: "A booking-specific Passport QR is required." }, 400);

    const database = db();
    const hash = await tokenHash(token);
    const assignment = await database.prepare(`SELECT p.officer_id AS officerId, p.passport_number AS passportNumber,
      b.client_id AS clientId,
      s.scheduled_date AS scheduledDate, s.status, s.passport_verification_status AS verificationStatus
      FROM officer_passports p JOIN shifts s ON s.officer_id = p.officer_id
      JOIN bookings b ON b.id = s.booking_id
      WHERE p.public_token_hash = ? AND s.id = ? AND s.booking_id = ?`)
      .bind(hash, shiftId, bookingId).first<{
        officerId: string; passportNumber: string; clientId: string; scheduledDate: string; status: string; verificationStatus: string;
      }>();

    if (!assignment) {
      const passport = await readPublicPassport(database, token, bookingId, shiftId);
      return response({ passport, error: "This officer is not assigned to the supplied LOKD shift." }, 409);
    }
    if (!principal.owner && principal.clientId !== assignment.clientId) {
      return response({ error: "This account is not authorised to verify that assignment." }, 403);
    }

    const readiness = await evaluateBookingReadiness(database, assignment.officerId, bookingId, {
      assignmentDate: assignment.scheduledDate,
    });
    if (assignment.verificationStatus === "green" && readiness.eligible) {
      const passport = await readPublicPassport(database, token, bookingId, shiftId);
      return response({ passport, alreadyVerified: true });
    }
    const now = new Date().toISOString();
    const scanId = `PVS-${crypto.randomUUID()}`;
    const result = readiness.eligible ? "green" : "red";
    const reason = readiness.eligible ? "Current Passport and assignment-specific readiness confirmed." : readiness.blockers.join(" ");

    const statements = [
      database.prepare(`INSERT INTO passport_scans
        (id, officer_id, passport_number, booking_id, shift_id, verification_mode, result, reason, created_at)
        VALUES (?, ?, ?, ?, ?, 'shift_qr', ?, ?, ?)`)
        .bind(scanId, assignment.officerId, assignment.passportNumber, bookingId, shiftId, result, reason, now),
      database.prepare(`INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'client', ?, 'passport_scanned', 'shift', ?, ?, ?)`)
        .bind(`AUD-${crypto.randomUUID()}`, principal.email, shiftId, `${result.toUpperCase()} Passport verification: ${reason}`, now),
    ];
    statements.push(database.prepare(`UPDATE shifts SET passport_verification_status = ?,
      passport_verified_at = ?, passport_scan_id = ?
      WHERE id = ? AND booking_id = ? AND officer_id = ?`)
      .bind(result, now, scanId, shiftId, bookingId, assignment.officerId));
    await database.batch(statements);

    const passport = await readPublicPassport(database, token, bookingId, shiftId);
    return response({ passport, readiness });
  } catch (cause) {
    if (cause instanceof PilotAccessError) return response({ error: cause.message }, cause.status);
    return response({ error: "Passport verification could not be recorded." }, 503);
  }
}
