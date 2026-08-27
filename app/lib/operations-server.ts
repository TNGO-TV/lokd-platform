import type { PilotPrincipal } from "./pilot-runtime";
import {
  ageInMinutes,
  deriveOperationalState,
  highestPriority,
  highestSeverity,
  nextOperationalAction,
  operationalStateLabel,
  signalFreshness,
} from "./operations-core";
import type {
  OperationsAction,
  OperationsCommandState,
  OperationsEvent,
  OperationsException,
  OperationsIncident,
  OperationsPost,
  OperationsSite,
} from "./operations-types";

const PILOT_CLIENT_ID = "CL-001";

export class OperationsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function eventId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isoOffset(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

function dateInJohannesburg(now: Date) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function all<T>(statement: D1PreparedStatement) {
  const result = await statement.all<T>();
  return result.results ?? [];
}

export async function ensureOperationsDemoData(db: D1Database) {
  const now = new Date();
  const today = dateInJohannesburg(now);
  const endDate = isoOffset(now, 60 * 24 * 30).slice(0, 10);
  const signalRetention = isoOffset(now, 60 * 24 * 30);
  const incidentRetention = isoOffset(now, 60 * 24 * 90);

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO clients
      (id, organisation_name, contact_name, contact_email, approval_status)
      VALUES (?, ?, ?, ?, 'approved')`)
      .bind(PILOT_CLIENT_ID, "Northbridge Property Services", "Nadia Jacobs", "nadia@northbridge.example"),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', ?)`)
      .bind("OFF-001", "Lerato Khumalo", "+27 82 555 0184", "lerato@example.co.za", "Johannesburg North", "PSIRA-1842", "Grade B", "2027-05-31", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', ?)`)
      .bind("OFF-002", "Ayanda Ncube", "+27 82 555 0202", "ayanda@example.co.za", "Midrand", "PSIRA-DEMO-202", "Grade C", "2027-06-30", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', ?)`)
      .bind("OFF-003", "Sibusiso Dlamini", "+27 82 555 0303", "sibusiso@example.co.za", "Johannesburg East", "PSIRA-DEMO-303", "Grade B", "2027-07-31", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '06:00', '18:00', 140000, 80000, 'paid_in_full', 'Weekly', 'active')`)
      .bind("BK-2081", PILOT_CLIENT_ID, "Northbridge Rosebank Offices", "Rosebank", "Main access", today, endDate),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '06:00', '18:00', 140000, 80000, 'paid_in_full', 'Weekly', 'staffed')`)
      .bind("BK-2084", PILOT_CLIENT_ID, "Metsi Midrand Depot", "Midrand", "Contractor access", today, endDate),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '18:00', '06:00', 140000, 80000, 'paid_in_full', 'Weekly', 'active')`)
      .bind("BK-2090", PILOT_CLIENT_ID, "Eastline Linbro Yard", "Linbro Park", "Vehicle gate", today, endDate),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'on_post', ?, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2081", "BK-2081", "OFF-001", today, isoOffset(now, -154)),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'confirmed', NULL, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2084", "BK-2084", "OFF-002", today),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'on_post', ?, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2090", "BK-2090", "OFF-003", today, isoOffset(now, -94)),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification, status, version, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated', 'operational', 'active', 1, 'demo-seed', ?, ?)`)
      .bind("SITE-RSB", PILOT_CLIENT_ID, "BK-2081", "Northbridge Rosebank Offices", "Rosebank", "Pilot address withheld · Rosebank", -26146800, 28041700, "Standard", 120, now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification, status, version, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated', 'operational', 'active', 1, 'demo-seed', ?, ?)`)
      .bind("SITE-MID", PILOT_CLIENT_ID, "BK-2084", "Metsi Midrand Depot", "Midrand", "Pilot address withheld · Midrand", -25999200, 28126300, "Enhanced", 140, now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification, status, version, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated', 'operational', 'active', 1, 'demo-seed', ?, ?)`)
      .bind("SITE-LIN", PILOT_CLIENT_ID, "BK-2090", "Eastline Linbro Yard", "Linbro Park", "Pilot address withheld · Linbro Park", -26084700, 28122400, "Enhanced", 160, now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unarmed', ?, 'Grade C', ?, 'active', ?, ?)`)
      .bind("POST-RSB-01", "SITE-RSB", "BK-2081", "Main access", "commercial_access", "PO-RSB-01.3", now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unarmed', ?, 'Grade C', ?, 'active', ?, ?)`)
      .bind("POST-MID-01", "SITE-MID", "BK-2084", "Contractor access", "construction", "PO-MID-02.1", now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unarmed', ?, 'Grade C', ?, 'active', ?, ?)`)
      .bind("POST-LIN-01", "SITE-LIN", "BK-2090", "Vehicle gate", "secure_logistics", "PO-LIN-01.6", now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_presence_signals
      (id, site_id, shift_id, officer_id, signal_type, latitude_e6, longitude_e6, accuracy_meters, source, source_session_id,
       sequence_number, idempotency_key, policy_version, geofence_version, environment, integrity_state, review_required,
       captured_at, received_at, retention_review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'simulated', ?, ?, ?, 'demo-synthetic-v1', 1, 'demo', 'synthetic', 0, ?, ?, ?)`)
      .bind("SIG-RSB-001", "SITE-RSB", "SH-2081", "OFF-001", "attendance_heartbeat", -26146820, 28041730, 18,
        "SESSION-DEMO-RSB", 1, "DEMO-RSB-1", isoOffset(now, -4), isoOffset(now, -4), signalRetention),
    db.prepare(`INSERT OR IGNORE INTO site_presence_signals
      (id, site_id, shift_id, officer_id, signal_type, latitude_e6, longitude_e6, accuracy_meters, source, source_session_id,
       sequence_number, idempotency_key, policy_version, geofence_version, environment, integrity_state, review_required,
       captured_at, received_at, retention_review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'simulated', ?, ?, ?, 'demo-synthetic-v1', 1, 'demo', 'synthetic', 0, ?, ?, ?)`)
      .bind("SIG-MID-001", "SITE-MID", "SH-2084", "OFF-002", "assignment_confirmed", -25999180, 28126280, 22,
        "SESSION-DEMO-MID", 1, "DEMO-MID-1", isoOffset(now, -9), isoOffset(now, -9), signalRetention),
    db.prepare(`INSERT OR IGNORE INTO site_presence_signals
      (id, site_id, shift_id, officer_id, signal_type, latitude_e6, longitude_e6, accuracy_meters, source, source_session_id,
       sequence_number, idempotency_key, policy_version, geofence_version, environment, integrity_state, review_required,
       captured_at, received_at, retention_review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'simulated', ?, ?, ?, 'demo-synthetic-v1', 1, 'demo', 'synthetic', 1, ?, ?, ?)`)
      .bind("SIG-LIN-001", "SITE-LIN", "SH-2090", "OFF-003", "attendance_heartbeat", -26084650, 28122320, 34,
        "SESSION-DEMO-LIN", 1, "DEMO-LIN-1", isoOffset(now, -38), isoOffset(now, -38), signalRetention),
    db.prepare(`INSERT OR IGNORE INTO site_incidents
      (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
       occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
       resolution_note, client_notified_at, retention_review_at, version)
      VALUES (?, ?, ?, 'medium', 'site_condition', ?, ?, 'open', 'operations', 'officer', 'OFF-003', ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 1)`)
      .bind("INC-DEMO-001", "SITE-LIN", "SH-2090", "Perimeter lighting exception", "Lighting along the east vehicle lane requires supervisor review. No injury or loss reported.",
        isoOffset(now, -28), isoOffset(now, -25), isoOffset(now, 35), incidentRetention),
    db.prepare(`INSERT OR IGNORE INTO site_incidents
      (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
       occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
       resolution_note, client_notified_at, retention_review_at, version)
      VALUES (?, ?, ?, 'low', 'access_control', ?, ?, 'resolved', 'operations', 'officer', 'OFF-001', ?, ?, 'operations-demo', ?, ?, 'operations-demo', ?, 'operations-demo', ?, ?, ?, 2)`)
      .bind("INC-DEMO-002", "SITE-RSB", "SH-2081", "Unscheduled visitor declined", "Host confirmed that no appointment existed. Access was declined without confrontation.",
        isoOffset(now, -132), isoOffset(now, -128), isoOffset(now, -68), isoOffset(now, -120), isoOffset(now, -96), "Procedure followed; no further action.", isoOffset(now, -90), incidentRetention),
    db.prepare(`INSERT OR IGNORE INTO incident_events
      (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
      VALUES (?, ?, 'case_opened', 'officer', 'OFF-003', ?, ?)`)
      .bind("IE-DEMO-001", "INC-DEMO-001", "Officer report received; Operations triage required.", isoOffset(now, -25)),
    db.prepare(`INSERT OR IGNORE INTO operational_exceptions
      (id, site_id, post_id, shift_id, exception_type, priority, status, summary, owner_id, detected_at, sla_due_at,
       acknowledged_at, resolved_at, resolution_code, resolution_note, version)
      VALUES (?, ?, ?, ?, 'signal_stale', 'P2', 'new', ?, NULL, ?, ?, NULL, NULL, NULL, NULL, 1)`)
      .bind("EXC-DEMO-001", "SITE-LIN", "POST-LIN-01", "SH-2090", "Synthetic attendance signal is older than the 15-minute monitoring threshold.", isoOffset(now, -23), isoOffset(now, 22)),
  ]);
}

type SiteRow = {
  id: string;
  clientId: string;
  clientName: string;
  bookingId: string | null;
  name: string;
  area: string;
  addressLabel: string;
  latitudeE6: number;
  longitudeE6: number;
  riskBand: string;
  serviceType: string;
  geofenceRadiusMeters: number;
  geofenceVersion: number;
  telemetryMode: "simulated";
  siteStatus: string;
};

export async function readOperationsState(db: D1Database): Promise<OperationsCommandState> {
  const now = new Date();
  const siteRows = await all<SiteRow>(db.prepare(`SELECT s.id, s.client_id AS clientId, c.organisation_name AS clientName,
    s.booking_id AS bookingId, s.name, s.area, s.address_label AS addressLabel, s.latitude_e6 AS latitudeE6,
    s.longitude_e6 AS longitudeE6, s.risk_band AS riskBand, s.service_type AS serviceType,
    s.geofence_radius_meters AS geofenceRadiusMeters, s.geofence_version AS geofenceVersion,
    s.telemetry_mode AS telemetryMode, s.status AS siteStatus
    FROM operational_sites s JOIN clients c ON c.id = s.client_id
    WHERE s.status <> 'archived' ORDER BY s.name`));
  const posts = await all<OperationsPost & { siteId: string }>(db.prepare(`SELECT id, site_id AS siteId,
    booking_id AS bookingId, name, service_type AS serviceType, purpose_code AS purposeCode,
    minimum_grade AS minimumGrade, post_orders_version AS postOrdersVersion, status
    FROM site_posts WHERE status <> 'archived' ORDER BY name`));
  const deployments = await all<{
    siteId: string; shiftId: string; bookingId: string; officerName: string; passportStatus: string | null;
    postName: string; scheduledDate: string; shiftStart: string; shiftEnd: string; status: string; checkInAt: string | null;
  }>(db.prepare(`SELECT os.id AS siteId, sh.id AS shiftId, b.id AS bookingId, o.full_name AS officerName,
    op.status AS passportStatus, b.post_name AS postName, sh.scheduled_date AS scheduledDate,
    b.shift_start AS shiftStart, b.shift_end AS shiftEnd, sh.status, sh.check_in_at AS checkInAt
    FROM operational_sites os JOIN bookings b ON b.id = os.booking_id
    LEFT JOIN shifts sh ON sh.booking_id = b.id
    LEFT JOIN officers o ON o.id = sh.officer_id
    LEFT JOIN officer_passports op ON op.officer_id = o.id
    ORDER BY sh.scheduled_date DESC, sh.rowid DESC`));
  const signals = await all<{
    id: string; siteId: string; type: string; latitudeE6: number; longitudeE6: number; accuracyMeters: number | null;
    source: "simulated"; integrityState: "synthetic"; capturedAt: string; receivedAt: string;
  }>(db.prepare(`SELECT id, site_id AS siteId, signal_type AS type, latitude_e6 AS latitudeE6,
    longitude_e6 AS longitudeE6, accuracy_meters AS accuracyMeters, source, integrity_state AS integrityState,
    captured_at AS capturedAt, received_at AS receivedAt
    FROM site_presence_signals WHERE environment = 'demo' ORDER BY captured_at DESC`));
  const incidentRows = await all<Omit<OperationsIncident, "siteName"> & { siteName: string }>(db.prepare(`SELECT i.id,
    i.site_id AS siteId, s.name AS siteName, i.severity, i.category, i.summary, i.detail, i.status,
    i.owner_id AS ownerId, i.occurred_at AS occurredAt, i.reported_at AS reportedAt, i.sla_due_at AS slaDueAt,
    i.acknowledged_at AS acknowledgedAt, i.resolved_at AS resolvedAt, i.version
    FROM site_incidents i JOIN operational_sites s ON s.id = i.site_id
    WHERE i.visibility = 'operations' ORDER BY i.reported_at DESC`));
  const exceptionRows = await all<OperationsException>(db.prepare(`SELECT e.id, e.site_id AS siteId,
    s.name AS siteName, e.priority, e.exception_type AS exceptionType, e.summary, e.status,
    e.owner_id AS ownerId, e.detected_at AS detectedAt, e.sla_due_at AS slaDueAt, e.version
    FROM operational_exceptions e JOIN operational_sites s ON s.id = e.site_id
    ORDER BY e.detected_at DESC`));
  const incidentEventRows = await all<{
    id: string; siteId: string; siteName: string; eventType: string; detail: string; createdAt: string;
  }>(db.prepare(`SELECT ie.id, i.site_id AS siteId, s.name AS siteName, ie.event_type AS eventType,
    ie.detail, ie.created_at AS createdAt FROM incident_events ie
    JOIN site_incidents i ON i.id = ie.incident_id JOIN operational_sites s ON s.id = i.site_id
    ORDER BY ie.created_at DESC LIMIT 20`));

  const latestDeployment = new Map<string, (typeof deployments)[number]>();
  for (const deployment of deployments) if (!latestDeployment.has(deployment.siteId)) latestDeployment.set(deployment.siteId, deployment);
  const latestSignal = new Map<string, (typeof signals)[number]>();
  for (const signal of signals) if (!latestSignal.has(signal.siteId)) latestSignal.set(signal.siteId, signal);
  const activeIncidents = incidentRows.filter((incident) => !["resolved", "closed"].includes(incident.status));
  const activeExceptions = exceptionRows.filter((exception) => !["resolved", "closed"].includes(exception.status));

  const sites: OperationsSite[] = siteRows.map((site) => {
    const deployment = latestDeployment.get(site.id);
    const signal = latestSignal.get(site.id);
    const signalAgeMinutes = ageInMinutes(signal?.capturedAt ?? null, now);
    const siteIncidents = activeIncidents.filter((incident) => incident.siteId === site.id);
    const siteExceptions = activeExceptions.filter((exception) => exception.siteId === site.id);
    const highestIncidentSeverity = highestSeverity(siteIncidents.map((incident) => incident.severity));
    const highestExceptionPriority = highestPriority(siteExceptions.map((exception) => exception.priority));
    const state = deriveOperationalState({
      active: site.siteStatus === "active",
      shiftStatus: deployment?.status ?? null,
      signalAgeMinutes,
      highestIncidentSeverity,
      highestExceptionPriority,
    });
    return {
      id: site.id,
      clientId: site.clientId,
      clientName: site.clientName,
      name: site.name,
      area: site.area,
      addressLabel: site.addressLabel,
      latitude: site.latitudeE6 / 1_000_000,
      longitude: site.longitudeE6 / 1_000_000,
      riskBand: site.riskBand,
      serviceType: site.serviceType,
      geofenceRadiusMeters: site.geofenceRadiusMeters,
      geofenceVersion: site.geofenceVersion,
      telemetryMode: site.telemetryMode,
      state,
      stateLabel: operationalStateLabel(state),
      signalFreshness: signalFreshness(signalAgeMinutes),
      openIncidentCount: siteIncidents.length,
      highestIncidentSeverity,
      openExceptionCount: siteExceptions.length,
      highestExceptionPriority,
      nextAction: nextOperationalAction({ state, highestExceptionPriority, openIncidentCount: siteIncidents.length, shiftStatus: deployment?.status ?? null }),
      posts: posts.filter((post) => post.siteId === site.id).map((post) => ({
        id: post.id,
        name: post.name,
        serviceType: post.serviceType,
        purposeCode: post.purposeCode,
        minimumGrade: post.minimumGrade,
        postOrdersVersion: post.postOrdersVersion,
        status: post.status,
        bookingId: post.bookingId,
      })),
      deployment: deployment ? {
        shiftId: deployment.shiftId,
        bookingId: deployment.bookingId,
        officerName: deployment.officerName,
        passportStatus: deployment.passportStatus,
        postName: deployment.postName,
        scheduledDate: deployment.scheduledDate,
        shiftStart: deployment.shiftStart,
        shiftEnd: deployment.shiftEnd,
        status: deployment.status,
        checkInAt: deployment.checkInAt,
      } : {
        shiftId: null, bookingId: site.bookingId, officerName: null, passportStatus: null, postName: null,
        scheduledDate: null, shiftStart: null, shiftEnd: null, status: null, checkInAt: null,
      },
      latestSignal: signal ? {
        id: signal.id,
        type: signal.type,
        latitude: signal.latitudeE6 / 1_000_000,
        longitude: signal.longitudeE6 / 1_000_000,
        accuracyMeters: signal.accuracyMeters,
        source: signal.source,
        integrityState: signal.integrityState,
        capturedAt: signal.capturedAt,
        receivedAt: signal.receivedAt,
        ageMinutes: signalAgeMinutes,
      } : null,
    };
  });

  const events: OperationsEvent[] = [
    ...signals.slice(0, 8).map((signal) => ({
      id: signal.id,
      siteId: signal.siteId,
      siteName: siteRows.find((site) => site.id === signal.siteId)?.name ?? "Site",
      type: "signal" as const,
      tone: signal.type === "attendance_heartbeat" ? "green" as const : "blue" as const,
      title: signal.type.replaceAll("_", " "),
      detail: `${signal.source} signal · ${signal.accuracyMeters ?? "—"}m stated accuracy`,
      occurredAt: signal.capturedAt,
    })),
    ...incidentRows.slice(0, 8).map((incident) => ({
      id: `case-${incident.id}`,
      siteId: incident.siteId,
      siteName: incident.siteName,
      type: "incident" as const,
      tone: incident.severity === "critical" || incident.severity === "high" ? "red" as const : incident.status === "resolved" ? "neutral" as const : "amber" as const,
      title: incident.summary,
      detail: `${incident.severity} · ${incident.status}`,
      occurredAt: incident.reportedAt,
    })),
    ...incidentEventRows.map((event) => ({
      id: event.id,
      siteId: event.siteId,
      siteName: event.siteName,
      type: "incident_event" as const,
      tone: "amber" as const,
      title: event.eventType.replaceAll("_", " "),
      detail: event.detail,
      occurredAt: event.createdAt,
    })),
    ...exceptionRows.slice(0, 8).map((exception) => ({
      id: exception.id,
      siteId: exception.siteId,
      siteName: exception.siteName,
      type: "exception" as const,
      tone: exception.priority === "P0" || exception.priority === "P1" ? "red" as const : "amber" as const,
      title: exception.exceptionType.replaceAll("_", " "),
      detail: `${exception.priority} · ${exception.status} · ${exception.summary}`,
      occurredAt: exception.detectedAt,
    })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 16);

  return {
    environment: "demo",
    telemetry: "simulated",
    generatedAt: now.toISOString(),
    timezone: "Africa/Johannesburg",
    refreshAfterMs: 30_000,
    summary: {
      sites: sites.length,
      operational: sites.filter((site) => site.state === "operational").length,
      scheduled: sites.filter((site) => site.state === "scheduled").length,
      attention: sites.filter((site) => site.state === "attention").length,
      critical: sites.filter((site) => site.state === "critical").length,
      openIncidents: activeIncidents.length,
      openExceptions: activeExceptions.length,
    },
    sites,
    incidents: incidentRows,
    exceptions: exceptionRows,
    events,
  };
}

function requireId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[A-Z0-9-]{3,72}$/.test(value)) throw new OperationsError(`${label} is not valid.`);
  return value;
}

function requireVersion(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 1_000_000) throw new OperationsError("The record version is not valid.");
  return Number(value);
}

function requireResolution(value: unknown) {
  if (typeof value !== "string") throw new OperationsError("Add a resolution note.");
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < 8 || clean.length > 500) throw new OperationsError("The resolution note must be between 8 and 500 characters.");
  return clean;
}

function requireText(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "string") throw new OperationsError(`${label} is required.`);
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < minimum || clean.length > maximum) throw new OperationsError(`${label} must be between ${minimum} and ${maximum} characters.`);
  return clean;
}

export async function applyOperationsAction(db: D1Database, payload: OperationsAction, actor: PilotPrincipal) {
  const now = new Date().toISOString();
  if (payload.action === "create_incident") {
    const siteId = requireId(payload.siteId, "Site");
    if (!["low", "medium", "high", "critical"].includes(payload.severity)) throw new OperationsError("Choose a valid incident severity.");
    const category = requireText(payload.category, "Category", 3, 48).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const summary = requireText(payload.summary, "Summary", 8, 120);
    const detail = requireText(payload.detail, "Incident detail", 12, 700);
    const site = await db.prepare(`SELECT id FROM operational_sites WHERE id = ? AND status = 'active'`)
      .bind(siteId).first<{ id: string }>();
    if (!site) throw new OperationsError("That active site is unavailable.", 404);
    const incidentId = eventId("INC-OPS");
    const slaMinutes = payload.severity === "critical" ? 5 : payload.severity === "high" ? 15 : payload.severity === "medium" ? 60 : 240;
    const slaDueAt = new Date(new Date(now).getTime() + slaMinutes * 60_000).toISOString();
    const retentionReviewAt = new Date(new Date(now).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await db.batch([
      db.prepare(`INSERT INTO site_incidents
        (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
         occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
         resolution_note, client_notified_at, retention_review_at, version)
        VALUES (?, ?, NULL, ?, ?, ?, ?, 'open', 'operations', 'operations', ?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 1)`)
        .bind(incidentId, siteId, payload.severity, category, summary, detail, actor.email, now, now, slaDueAt, retentionReviewAt),
      db.prepare(`INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'case_opened', 'operations', ?, 'Operations created the incident case.', ?)`)
        .bind(eventId("IE"), incidentId, actor.email, now),
      db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'incident_created', 'incident', ?, 'Operations incident case created.', ?)`)
        .bind(eventId("AUD"), actor.email, incidentId, now),
    ]);
    return;
  }

  if (payload.action === "acknowledge_incident") {
    const incidentId = requireId(payload.incidentId, "Incident");
    const version = requireVersion(payload.version);
    const result = await db.prepare(`UPDATE site_incidents SET status = 'acknowledged', owner_id = ?,
      acknowledged_at = ?, acknowledged_by = ?, version = version + 1
      WHERE id = ? AND version = ? AND status = 'open'`)
      .bind(actor.email, now, actor.email, incidentId, version).run();
    if (!result.meta.changes) throw new OperationsError("This incident changed before your action. Refresh and try again.", 409);
    await db.batch([
      db.prepare(`INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'acknowledged', 'operations', ?, 'Operations ownership accepted; investigation remains open.', ?)`)
        .bind(eventId("IE"), incidentId, actor.email, now),
      db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'incident_acknowledged', 'incident', ?, 'Operations accepted ownership; incident remains active.', ?)`)
        .bind(eventId("AUD"), actor.email, incidentId, now),
    ]);
    return;
  }

  if (payload.action === "resolve_incident") {
    const incidentId = requireId(payload.incidentId, "Incident");
    const version = requireVersion(payload.version);
    const resolutionNote = requireResolution(payload.resolutionNote);
    const result = await db.prepare(`UPDATE site_incidents SET status = 'resolved', resolved_at = ?, resolved_by = ?,
      resolution_note = ?, version = version + 1
      WHERE id = ? AND version = ? AND status IN ('acknowledged', 'investigating')`)
      .bind(now, actor.email, resolutionNote, incidentId, version).run();
    if (!result.meta.changes) throw new OperationsError("Acknowledge the current incident version before resolving it.", 409);
    await db.batch([
      db.prepare(`INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'resolved', 'operations', ?, ?, ?)`)
        .bind(eventId("IE"), incidentId, actor.email, resolutionNote, now),
      db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'incident_resolved', 'incident', ?, 'Resolution recorded in the incident case.', ?)`)
        .bind(eventId("AUD"), actor.email, incidentId, now),
    ]);
    return;
  }

  if (payload.action === "acknowledge_exception") {
    const exceptionId = requireId(payload.exceptionId, "Exception");
    const version = requireVersion(payload.version);
    const result = await db.prepare(`UPDATE operational_exceptions SET status = 'acknowledged', owner_id = ?,
      acknowledged_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status = 'new'`)
      .bind(actor.email, now, exceptionId, version).run();
    if (!result.meta.changes) throw new OperationsError("This exception changed before your action. Refresh and try again.", 409);
    await db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', ?, 'exception_acknowledged', 'operational_exception', ?, 'Operations accepted ownership; exception remains active.', ?)`)
      .bind(eventId("AUD"), actor.email, exceptionId, now).run();
    return;
  }

  throw new OperationsError("Choose a valid Operations action.");
}
