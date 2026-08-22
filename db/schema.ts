import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const officerApplications = sqliteTable(
  "officer_applications",
  {
    id: text("id").primaryKey(),
    pathway: text("pathway").notNull(),
    fullName: text("full_name").notNull(),
    mobileNormalized: text("mobile_normalized").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    city: text("city").notNull(),
    province: text("province").notNull(),
    psiraStatus: text("psira_status").notNull(),
    psiraNumber: text("psira_number"),
    psiraGrade: text("psira_grade"),
    serviceInterests: text("service_interests").notNull(),
    purposeInterests: text("purpose_interests").notNull().default("[]"),
    trainingInterests: text("training_interests").notNull(),
    over18Confirmed: integer("over_18_confirmed").notNull(),
    eligibilityAcknowledged: integer("eligibility_acknowledged").notNull(),
    privacyNoticeVersion: text("privacy_notice_version").notNull(),
    privacyAcknowledgedAt: text("privacy_acknowledged_at").notNull(),
    identityVerificationStatus: text("identity_verification_status").notNull().default("not_started"),
    identityProvider: text("identity_provider"),
    identityProviderReference: text("identity_provider_reference"),
    identityVerifiedAt: text("identity_verified_at"),
    status: text("status").notNull().default("submitted"),
    source: text("source").notNull().default("homepage"),
    retentionReviewAt: text("retention_review_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("officer_applications_mobile_idx").on(table.mobileNormalized),
    index("officer_applications_status_idx").on(table.status),
    index("officer_applications_pathway_idx").on(table.pathway),
    index("officer_applications_created_idx").on(table.createdAt),
  ],
);

export const officers = sqliteTable("officers", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  psiraNumber: text("psira_number").notNull(),
  psiraGrade: text("psira_grade").notNull(),
  psiraExpiry: text("psira_expiry").notNull(),
  approvalStatus: text("approval_status").notNull().default("pending"),
  bankingStatus: text("banking_status").notNull().default("unverified"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const officerPassports = sqliteTable(
  "officer_passports",
  {
    officerId: text("officer_id").primaryKey().references(() => officers.id, { onDelete: "cascade" }),
    passportNumber: text("passport_number").notNull(),
    publicTokenHash: text("public_token_hash").notNull(),
    status: text("status").notNull().default("training"),
    readinessLabel: text("readiness_label").notNull().default("LOKD Ready"),
    issuedAt: text("issued_at"),
    lastReviewedAt: text("last_reviewed_at"),
    nextReviewAt: text("next_review_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("officer_passports_number_idx").on(table.passportNumber),
    uniqueIndex("officer_passports_token_hash_idx").on(table.publicTokenHash),
  ],
);

export const officerEndorsements = sqliteTable(
  "officer_endorsements",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    serviceType: text("service_type"),
    purposeCode: text("purpose_code"),
    status: text("status").notNull().default("training"),
    assessedAt: text("assessed_at"),
    expiresAt: text("expires_at"),
    nextDueAt: text("next_due_at"),
    assessor: text("assessor"),
    clientVisible: integer("client_visible").notNull().default(1),
  },
  (table) => [
    uniqueIndex("officer_endorsements_officer_code_idx").on(table.officerId, table.code),
    index("officer_endorsements_officer_idx").on(table.officerId),
    index("officer_endorsements_purpose_idx").on(table.purposeCode),
  ],
);

export const officerServices = sqliteTable(
  "officer_services",
  {
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    serviceType: text("service_type").notNull(),
    qualified: integer("qualified").notNull().default(0),
    optedIn: integer("opted_in").notNull().default(0),
    qualificationExpiry: text("qualification_expiry"),
  },
  (table) => [primaryKey({ columns: [table.officerId, table.serviceType] })],
);

export const complianceRecords = sqliteTable(
  "compliance_records",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(),
    status: text("status").notNull(),
    verifiedAt: text("verified_at"),
    expiresAt: text("expires_at"),
    nextDueAt: text("next_due_at"),
  },
  (table) => [index("compliance_officer_idx").on(table.officerId)],
);

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  organisationName: text("organisation_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  approvalStatus: text("approval_status").notNull().default("pending"),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id),
    siteName: text("site_name").notNull(),
    siteArea: text("site_area").notNull(),
    postName: text("post_name").notNull(),
    serviceType: text("service_type").notNull(),
    purposeCode: text("purpose_code").notNull().default("commercial_access"),
    purposeLabel: text("purpose_label").notNull().default("Commercial access"),
    minimumGrade: text("minimum_grade").notNull(),
    contractMonths: integer("contract_months").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    shiftStart: text("shift_start").notNull(),
    shiftEnd: text("shift_end").notNull(),
    clientPriceCents: integer("client_price_cents").notNull(),
    officerRateCents: integer("officer_rate_cents").notNull(),
    fundingStatus: text("funding_status").notNull().default("unfunded"),
    releaseCadence: text("release_cadence").notNull(),
    status: text("status").notNull().default("draft"),
  },
  (table) => [index("bookings_client_idx").on(table.clientId)],
);

export const offers = sqliteTable(
  "offers",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("open"),
    expiresAt: text("expires_at").notNull(),
    respondedAt: text("responded_at"),
  },
  (table) => [
    index("offers_officer_idx").on(table.officerId),
    index("offers_booking_idx").on(table.bookingId),
  ],
);

export const shifts = sqliteTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    scheduledDate: text("scheduled_date").notNull(),
    status: text("status").notNull().default("confirmed"),
    checkInAt: text("check_in_at"),
    checkOutAt: text("check_out_at"),
    passportVerificationStatus: text("passport_verification_status").notNull().default("not_checked"),
    passportVerifiedAt: text("passport_verified_at"),
    passportScanId: text("passport_scan_id"),
    clientSignoffStatus: text("client_signoff_status").notNull().default("not_due"),
    signedOffAt: text("signed_off_at"),
    earningsCents: integer("earnings_cents").notNull(),
  },
  (table) => [
    index("shifts_officer_idx").on(table.officerId),
    index("shifts_booking_idx").on(table.bookingId),
  ],
);

export const passportScans = sqliteTable(
  "passport_scans",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    passportNumber: text("passport_number").notNull(),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    shiftId: text("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    verificationMode: text("verification_mode").notNull().default("public_qr"),
    result: text("result").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("passport_scans_officer_idx").on(table.officerId),
    index("passport_scans_shift_idx").on(table.shiftId),
    index("passport_scans_created_idx").on(table.createdAt),
  ],
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    shiftId: text("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    state: text("state").notNull(),
    releaseCadence: text("release_cadence").notNull(),
    eligibleReleaseAt: text("eligible_release_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("ledger_officer_idx").on(table.officerId),
    index("ledger_state_idx").on(table.state),
  ],
);

export const payoutRequests = sqliteTable(
  "payout_requests",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("queued"),
    requestedAt: text("requested_at").notNull(),
    expectedSettlementDate: text("expected_settlement_date").notNull(),
  },
  (table) => [index("payout_officer_idx").on(table.officerId)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)],
);

export const pilotFeedback = sqliteTable(
  "pilot_feedback",
  {
    id: text("id").primaryKey(),
    reviewerEmail: text("reviewer_email"),
    route: text("route").notNull(),
    role: text("role").notNull(),
    category: text("category").notNull(),
    score: integer("score"),
    note: text("note").notNull(),
    status: text("status").notNull().default("new"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("pilot_feedback_status_idx").on(table.status),
    index("pilot_feedback_created_idx").on(table.createdAt),
  ],
);
