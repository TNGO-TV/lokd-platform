import { evaluateReadiness } from "./passport-rules";
import type { PassportEndorsement, PassportStatus, ServiceType } from "./pilot-types";

export const PILOT_PASSPORT_NUMBER = "LKD-P-1842";
export const PILOT_PASSPORT_TOKEN = "lokdvp_7f4a2c91e6d84b3fa92c1d8e5a70b641";

async function all<T>(statement: D1PreparedStatement) {
  const result = await statement.all<T>();
  return result.results ?? [];
}

export async function tokenHash(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readEndorsements(db: D1Database, officerId: string, clientVisibleOnly = false) {
  return all<PassportEndorsement>(db.prepare(`SELECT id, code, label, category, service_type AS serviceType,
    purpose_code AS purposeCode, status, assessed_at AS assessedAt, expires_at AS expiresAt,
    next_due_at AS nextDueAt FROM officer_endorsements WHERE officer_id = ?
    ${clientVisibleOnly ? "AND client_visible = 1" : ""}
    ORDER BY CASE category WHEN 'core' THEN 1 WHEN 'service' THEN 2 WHEN 'purpose' THEN 3 ELSE 4 END, label`)
    .bind(officerId));
}

type BookingReadinessOptions = {
  assignmentDate?: string;
  requireServiceOptIn?: boolean;
};

export async function evaluateBookingReadiness(
  db: D1Database,
  officerId: string,
  bookingId: string,
  options: BookingReadinessOptions = {},
) {
  const row = await db.prepare(`SELECT b.id AS bookingId, b.service_type AS serviceType,
    b.purpose_code AS purposeCode, b.minimum_grade AS minimumGrade, b.funding_status AS fundingStatus,
    b.start_date AS startDate, o.approval_status AS approvalStatus, o.psira_grade AS psiraGrade,
    o.psira_expiry AS psiraExpiry, p.status AS passportStatus, p.next_review_at AS passportNextReviewAt,
    os.qualified AS serviceQualified, os.opted_in AS serviceOptedIn,
    os.qualification_expiry AS qualificationExpiry
    FROM bookings b
    JOIN officers o ON o.id = ?
    LEFT JOIN officer_passports p ON p.officer_id = o.id
    LEFT JOIN officer_services os ON os.officer_id = o.id AND os.service_type = b.service_type
    WHERE b.id = ?`).bind(officerId, bookingId).first<{
      bookingId: string;
      serviceType: ServiceType;
      purposeCode: string;
      minimumGrade: string;
      fundingStatus: string;
      startDate: string;
      approvalStatus: string;
      psiraGrade: string;
      psiraExpiry: string;
      passportStatus: PassportStatus | null;
      passportNextReviewAt: string | null;
      serviceQualified: number | null;
      serviceOptedIn: number | null;
      qualificationExpiry: string | null;
    }>();
  if (!row) return { eligible: false, displayStatus: "restricted" as PassportStatus, blockers: ["Booking or officer record was not found."], warnings: [] };
  const endorsements = await readEndorsements(db, officerId);
  return evaluateReadiness({
    assignmentDate: options.assignmentDate ?? row.startDate,
    fundingStatus: row.fundingStatus,
    approvalStatus: row.approvalStatus,
    psiraGrade: row.psiraGrade,
    minimumGrade: row.minimumGrade,
    psiraExpiry: row.psiraExpiry,
    passportStatus: row.passportStatus ?? "training",
    passportNextReviewAt: row.passportNextReviewAt,
    serviceType: row.serviceType,
    serviceQualified: Boolean(row.serviceQualified),
    serviceOptedIn: Boolean(row.serviceOptedIn),
    requireServiceOptIn: options.requireServiceOptIn,
    qualificationExpiry: row.qualificationExpiry,
    purposeCode: row.purposeCode,
    endorsements,
  });
}

export type PublicPassport = {
  passportNumber: string;
  officerName: string;
  initials: string;
  psiraGrade: string;
  psiraCurrent: boolean;
  readinessLabel: string;
  status: PassportStatus;
  result: "green" | "amber" | "red" | "grey";
  message: string;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  endorsements: PassportEndorsement[];
  assignment: null | {
    matched: boolean;
    serviceType: ServiceType | null;
    purposeLabel: string | null;
    scheduledDate: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    verificationStatus: string | null;
    verifiedAt: string | null;
  };
  verifiedAt: string;
};

export async function readPublicPassport(db: D1Database, rawToken: string, bookingId?: string | null, shiftId?: string | null): Promise<PublicPassport | null> {
  if (!rawToken || rawToken.length < 24) return null;
  const hash = await tokenHash(rawToken);
  const passport = await db.prepare(`SELECT p.officer_id AS officerId, p.passport_number AS passportNumber,
    p.status, p.readiness_label AS readinessLabel, p.last_reviewed_at AS lastReviewedAt,
    p.next_review_at AS nextReviewAt, o.full_name AS officerName, o.psira_grade AS psiraGrade,
    o.psira_expiry AS psiraExpiry FROM officer_passports p JOIN officers o ON o.id = p.officer_id
    WHERE p.public_token_hash = ?`).bind(hash).first<{
      officerId: string;
      passportNumber: string;
      status: PassportStatus;
      readinessLabel: string;
      lastReviewedAt: string | null;
      nextReviewAt: string | null;
      officerName: string;
      psiraGrade: string;
      psiraExpiry: string;
    }>();
  if (!passport) return null;

  const today = new Date().toISOString().slice(0, 10);
  const psiraCurrent = passport.psiraExpiry.slice(0, 10) >= today;
  const coreStatusCurrent = passport.status === "active" || passport.status === "expiring";
  const reviewCurrent = !passport.nextReviewAt || passport.nextReviewAt.slice(0, 10) >= today;
  const endorsements = (await readEndorsements(db, passport.officerId, true)).filter((item) => (
    item.status === "current"
    && (!item.expiresAt || item.expiresAt.slice(0, 10) >= today)
    && (!item.nextDueAt || item.nextDueAt.slice(0, 10) >= today)
  ));
  const core = endorsements.find((item) => item.code === "core_ready");
  const coreCurrent = Boolean(
    core
    && core.status === "current"
    && (!core.expiresAt || core.expiresAt.slice(0, 10) >= today)
    && (!core.nextDueAt || core.nextDueAt.slice(0, 10) >= today),
  );

  let assignment: PublicPassport["assignment"] = null;
  let assignmentReady = true;
  let assignmentMatch = true;
  if (bookingId || shiftId) {
    const row = bookingId && shiftId ? await db.prepare(`SELECT b.id AS bookingId, b.service_type AS serviceType,
      b.purpose_label AS purposeLabel, s.scheduled_date AS scheduledDate, b.shift_start AS shiftStart,
      b.shift_end AS shiftEnd, s.passport_verification_status AS verificationStatus,
      s.passport_verified_at AS verifiedAt FROM shifts s JOIN bookings b ON b.id = s.booking_id
      WHERE s.id = ? AND b.id = ? AND s.officer_id = ?`)
      .bind(shiftId, bookingId, passport.officerId).first<{
        bookingId: string; serviceType: ServiceType; purposeLabel: string; scheduledDate: string;
        shiftStart: string; shiftEnd: string; verificationStatus: string; verifiedAt: string | null;
      }>() : null;
    assignmentMatch = Boolean(row);
    if (row && bookingId) {
      const readiness = await evaluateBookingReadiness(db, passport.officerId, bookingId, {
        assignmentDate: row.scheduledDate,
      });
      assignmentReady = readiness.eligible;
    }
    assignment = row ? { matched: true, serviceType: row.serviceType, purposeLabel: row.purposeLabel,
      scheduledDate: row.scheduledDate, shiftStart: row.shiftStart, shiftEnd: row.shiftEnd,
      verificationStatus: row.verificationStatus, verifiedAt: row.verifiedAt }
      : { matched: false, serviceType: null, purposeLabel: null, scheduledDate: null,
        shiftStart: null, shiftEnd: null, verificationStatus: null, verifiedAt: null };
  }

  let result: PublicPassport["result"] = "green";
  let message = "Passport current. Officer is LOKD Ready.";
  if (!coreStatusCurrent || !reviewCurrent || !psiraCurrent || !coreCurrent) {
    result = "red";
    message = "Passport is not current. Do not deploy this officer until LOKD confirms clearance.";
  } else if (!assignmentMatch) {
    result = "amber";
    message = "Passport is current, but this officer is not assigned to the supplied booking and shift.";
  } else if (!assignmentReady) {
    result = "red";
    message = "Passport or assignment readiness is not current. Do not deploy this officer until LOKD confirms clearance.";
  } else if (passport.status === "expiring") {
    result = "amber";
    message = "Passport is current for this assignment. A readiness review is due soon.";
  }

  const initials = passport.officerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return {
    passportNumber: passport.passportNumber,
    officerName: passport.officerName,
    initials,
    psiraGrade: passport.psiraGrade,
    psiraCurrent,
    readinessLabel: passport.readinessLabel,
    status: passport.status,
    result,
    message,
    lastReviewedAt: passport.lastReviewedAt,
    nextReviewAt: passport.nextReviewAt,
    endorsements,
    assignment,
    verifiedAt: new Date().toISOString(),
  };
}
