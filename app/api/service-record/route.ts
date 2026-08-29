import { env } from "cloudflare:workers";
import { PilotAccessError, requirePilotApiRole } from "../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

class ServiceRecordError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function GET(request: Request) {
  try {
    const principal = requirePilotApiRole(request, "client");
    const clientId = principal.clientId ?? (principal.owner ? "CL-001" : null);
    if (!clientId) throw new ServiceRecordError("This account is not assigned to a pilot client.", 403);
    if (!env.DB) throw new ServiceRecordError("The service record backend is unavailable.", 503);
    const requestedShift = new URL(request.url).searchParams.get("shift");
    if (requestedShift && !/^[A-Z0-9-]{4,80}$/.test(requestedShift)) throw new ServiceRecordError("Choose a valid shift reference.");
    const result = await env.DB.prepare(`SELECT shift.id AS shiftId, booking.id AS bookingId,
      booking.site_name AS siteName, booking.post_name AS postName, booking.service_type AS serviceType,
      shift.scheduled_date AS scheduledDate, booking.shift_start AS shiftStart, booking.shift_end AS shiftEnd,
      officer.full_name AS officerName, passport.passport_number AS passportNumber,
      shift.status, shift.check_in_at AS checkInAt, shift.check_out_at AS checkOutAt,
      shift.client_signoff_status AS clientSignoffStatus, shift.signed_off_at AS signedOffAt,
      shift.passport_verification_status AS passportVerificationStatus,
      shift.passport_verified_at AS passportVerifiedAt
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      JOIN officers officer ON officer.id = shift.officer_id
      LEFT JOIN officer_passports passport ON passport.officer_id = officer.id
      WHERE booking.client_id = ? AND booking.environment = 'demo'
       AND booking.integrity_state = 'synthetic' AND shift.environment = 'demo'
       AND shift.integrity_state = 'synthetic' AND (? IS NULL OR shift.id = ?)
      ORDER BY shift.scheduled_date DESC, shift.id DESC LIMIT 100`)
      .bind(clientId, requestedShift, requestedShift).all<Record<string, string | null>>();
    const generatedAt = new Date().toISOString();
    const document = {
      title: "LOKD synthetic service record",
      environment: "demo",
      productionAuthorised: false,
      generatedAt,
      clientId,
      records: result.results ?? [],
      notice: "This export contains synthetic demonstration records only. It is not an invoice, payslip or proof of production security deployment.",
    };
    return new Response(JSON.stringify(document, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="lokd-demo-service-record-${generatedAt.slice(0, 10)}.json"`,
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
        vary: "oai-authenticated-user-email",
      },
    });
  } catch (cause) {
    const error = cause instanceof ServiceRecordError || cause instanceof PilotAccessError
      ? cause
      : new ServiceRecordError("The service record could not be generated.", 500);
    return Response.json({ error: error.message }, { status: error.status, headers: { "cache-control": "no-store" } });
  }
}
