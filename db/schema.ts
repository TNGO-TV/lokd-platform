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
  flexAvailable: integer("flex_available").notNull().default(0),
  externalWorkAcknowledged: integer("external_work_acknowledged").notNull().default(0),
  restWindowConfirmed: integer("rest_window_confirmed").notNull().default(0),
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
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
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
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
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
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
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
  environment: text("environment").notNull().default("demo"),
  integrityState: text("integrity_state").notNull().default("synthetic"),
});

export const launchControls = sqliteTable(
  "launch_controls",
  {
    code: text("code").primaryKey(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("pending"),
    evidenceLevel: text("evidence_level").notNull().default("none"),
    evidenceReference: text("evidence_reference"),
    detail: text("detail").notNull().default(""),
    hardGate: integer("hard_gate").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    verifiedBy: text("verified_by"),
    verifiedAt: text("verified_at"),
    expiresAt: text("expires_at"),
    version: integer("version").notNull().default(1),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("launch_controls_category_idx").on(table.category, table.sortOrder),
    index("launch_controls_status_idx").on(table.status),
  ],
);

export const workforceEmployers = sqliteTable(
  "workforce_employers",
  {
    id: text("id").primaryKey(),
    legalName: text("legal_name").notNull(),
    employerType: text("employer_type").notNull(),
    environment: text("environment").notNull().default("demo"),
    psiraStatus: text("psira_status").notNull().default("pending"),
    nbcpssStatus: text("nbcpss_status").notNull().default("pending"),
    psspfStatus: text("psspf_status").notNull().default("pending"),
    uifStatus: text("uif_status").notNull().default("pending"),
    coidaStatus: text("coida_status").notNull().default("pending"),
    insuranceStatus: text("insurance_status").notNull().default("pending"),
    serviceAgreementStatus: text("service_agreement_status").notNull().default("pending"),
    status: text("status").notNull().default("pending"),
    lastReviewedAt: text("last_reviewed_at"),
    reviewDueAt: text("review_due_at"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("workforce_employers_type_status_idx").on(table.employerType, table.status),
    index("workforce_employers_review_idx").on(table.reviewDueAt),
  ],
);

export const workforceEngagements = sqliteTable(
  "workforce_engagements",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    model: text("model").notNull(),
    environment: text("environment").notNull().default("demo"),
    status: text("status").notNull().default("pending_activation"),
    activeKey: text("active_key"),
    engagementReference: text("engagement_reference").notNull(),
    termsVersion: text("terms_version"),
    payrollStatus: text("payroll_status").notNull().default("not_ready"),
    benefitsStatus: text("benefits_status").notNull().default("not_ready"),
    weeklyHourCap: integer("weekly_hour_cap"),
    activatedAt: text("activated_at"),
    endedAt: text("ended_at"),
    reviewDueAt: text("review_due_at"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("workforce_engagements_officer_status_idx").on(table.officerId, table.status),
    index("workforce_engagements_employer_status_idx").on(table.employerId, table.status),
    index("workforce_engagements_model_status_idx").on(table.model, table.status),
    uniqueIndex("workforce_engagements_active_officer_idx").on(table.activeKey),
  ],
);

export const operationalSites = sqliteTable(
  "operational_sites",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    area: text("area").notNull(),
    addressLabel: text("address_label").notNull(),
    latitudeE6: integer("latitude_e6").notNull(),
    longitudeE6: integer("longitude_e6").notNull(),
    timezone: text("timezone").notNull().default("Africa/Johannesburg"),
    riskBand: text("risk_band").notNull().default("Standard"),
    serviceType: text("service_type").notNull().default("Unarmed"),
    geofenceRadiusMeters: integer("geofence_radius_meters").notNull().default(120),
    geofenceVersion: integer("geofence_version").notNull().default(1),
    telemetryMode: text("telemetry_mode").notNull().default("simulated"),
    sensitivityClassification: text("sensitivity_classification").notNull().default("operational"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    status: text("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by").notNull().default("system"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("operational_sites_client_idx").on(table.clientId),
    index("operational_sites_booking_idx").on(table.bookingId),
    index("operational_sites_status_idx").on(table.status),
  ],
);

export const sitePosts = sqliteTable(
  "site_posts",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    serviceType: text("service_type").notNull().default("Unarmed"),
    purposeCode: text("purpose_code").notNull().default("commercial_access"),
    minimumGrade: text("minimum_grade").notNull().default("Grade C"),
    postOrdersVersion: text("post_orders_version").notNull().default("draft"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("site_posts_site_idx").on(table.siteId),
    index("site_posts_booking_idx").on(table.bookingId),
    index("site_posts_status_idx").on(table.status),
  ],
);

export const sitePresenceSignals = sqliteTable(
  "site_presence_signals",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    shiftId: text("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    officerId: text("officer_id").references(() => officers.id, { onDelete: "set null" }),
    signalType: text("signal_type").notNull(),
    latitudeE6: integer("latitude_e6").notNull(),
    longitudeE6: integer("longitude_e6").notNull(),
    accuracyMeters: integer("accuracy_meters"),
    source: text("source").notNull().default("simulated"),
    sourceSessionId: text("source_session_id"),
    sequenceNumber: integer("sequence_number"),
    idempotencyKey: text("idempotency_key"),
    policyVersion: text("policy_version").notNull().default("demo-synthetic-v1"),
    geofenceVersion: integer("geofence_version").notNull().default(1),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    reviewRequired: integer("review_required").notNull().default(0),
    capturedAt: text("captured_at").notNull(),
    receivedAt: text("received_at").notNull(),
    retentionReviewAt: text("retention_review_at").notNull(),
  },
  (table) => [
    index("site_presence_site_time_idx").on(table.siteId, table.capturedAt),
    index("site_presence_shift_idx").on(table.shiftId),
    index("site_presence_officer_idx").on(table.officerId),
    uniqueIndex("site_presence_idempotency_idx").on(table.idempotencyKey),
  ],
);

export const siteIncidents = sqliteTable(
  "site_incidents",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    shiftId: text("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    summary: text("summary").notNull(),
    detail: text("detail").notNull().default(""),
    status: text("status").notNull().default("open"),
    visibility: text("visibility").notNull().default("operations"),
    reportedByType: text("reported_by_type").notNull(),
    reportedById: text("reported_by_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
    reportedAt: text("reported_at").notNull(),
    ownerId: text("owner_id"),
    slaDueAt: text("sla_due_at"),
    acknowledgedAt: text("acknowledged_at"),
    acknowledgedBy: text("acknowledged_by"),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),
    clientNotifiedAt: text("client_notified_at"),
    retentionReviewAt: text("retention_review_at").notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("site_incidents_site_time_idx").on(table.siteId, table.reportedAt),
    index("site_incidents_status_idx").on(table.status),
    index("site_incidents_severity_idx").on(table.severity),
    index("site_incidents_shift_idx").on(table.shiftId),
  ],
);

export const incidentEvents = sqliteTable(
  "incident_events",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id").notNull().references(() => siteIncidents.id),
    eventType: text("event_type").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("incident_events_incident_time_idx").on(table.incidentId, table.createdAt)],
);

export const operationalExceptions = sqliteTable(
  "operational_exceptions",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    postId: text("post_id").references(() => sitePosts.id, { onDelete: "set null" }),
    shiftId: text("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    exceptionType: text("exception_type").notNull(),
    priority: text("priority").notNull(),
    status: text("status").notNull().default("new"),
    summary: text("summary").notNull(),
    ownerId: text("owner_id"),
    detectedAt: text("detected_at").notNull(),
    slaDueAt: text("sla_due_at").notNull(),
    acknowledgedAt: text("acknowledged_at"),
    resolvedAt: text("resolved_at"),
    resolutionCode: text("resolution_code"),
    resolutionNote: text("resolution_note"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("operational_exceptions_site_time_idx").on(table.siteId, table.detectedAt),
    index("operational_exceptions_status_idx").on(table.status),
    index("operational_exceptions_priority_idx").on(table.priority),
    index("operational_exceptions_shift_idx").on(table.shiftId),
  ],
);

export const rosterSlots = sqliteTable(
  "roster_slots",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    postId: text("post_id").notNull().references(() => sitePosts.id),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    serviceDate: text("service_date").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    arrivalDueAt: text("arrival_due_at").notNull(),
    checkInDueAt: text("check_in_due_at").notNull(),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    status: text("status").notNull().default("scheduled"),
    absenceReason: text("absence_reason"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("roster_slots_site_start_idx").on(table.siteId, table.startsAt),
    index("roster_slots_status_start_idx").on(table.status, table.startsAt),
  ],
);

export const rosterAssignments = sqliteTable(
  "roster_assignments",
  {
    id: text("id").primaryKey(),
    rosterSlotId: text("roster_slot_id").notNull().references(() => rosterSlots.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    shiftId: text("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    assignmentKind: text("assignment_kind").notNull().default("primary"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    status: text("status").notNull().default("confirmed"),
    activeKey: text("active_key"),
    assignedBy: text("assigned_by").notNull(),
    assignedAt: text("assigned_at").notNull(),
    confirmedAt: text("confirmed_at"),
    releasedAt: text("released_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("roster_assignments_slot_time_idx").on(table.rosterSlotId, table.assignedAt),
    index("roster_assignments_officer_status_idx").on(table.officerId, table.status),
    uniqueIndex("roster_assignments_active_slot_idx").on(table.activeKey),
    uniqueIndex("roster_assignments_shift_idx").on(table.shiftId),
  ],
);

export const assignmentWorkforceSnapshots = sqliteTable(
  "assignment_workforce_snapshots",
  {
    id: text("id").primaryKey(),
    rosterAssignmentId: text("roster_assignment_id").notNull().references(() => rosterAssignments.id),
    workforceEngagementId: text("workforce_engagement_id").notNull().references(() => workforceEngagements.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    workforceModel: text("workforce_model").notNull(),
    employerLegalName: text("employer_legal_name").notNull(),
    termsVersion: text("terms_version").notNull(),
    decision: text("decision").notNull(),
    blockers: text("blockers").notNull().default("[]"),
    environment: text("environment").notNull().default("demo"),
    capturedAt: text("captured_at").notNull(),
  },
  (table) => [
    uniqueIndex("assignment_workforce_roster_assignment_idx").on(table.rosterAssignmentId),
    index("assignment_workforce_officer_idx").on(table.officerId),
    index("assignment_workforce_employer_idx").on(table.employerId),
  ],
);

export const officerAvailabilityWindows = sqliteTable(
  "officer_availability_windows",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    source: text("source").notNull().default("officer_declared"),
    status: text("status").notNull().default("available"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
    restConfirmedAt: text("rest_confirmed_at").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("officer_availability_officer_window_idx").on(table.officerId, table.startsAt, table.endsAt),
    index("officer_availability_status_window_idx").on(table.status, table.startsAt, table.endsAt),
  ],
);

export const reliefDispatches = sqliteTable(
  "relief_dispatches",
  {
    id: text("id").primaryKey(),
    rosterSlotId: text("roster_slot_id").notNull().references(() => rosterSlots.id),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    exceptionId: text("exception_id").references(() => operationalExceptions.id, { onDelete: "set null" }),
    replacementOfficerId: text("replacement_officer_id").notNull().references(() => officers.id),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    activeKey: text("active_key"),
    status: text("status").notNull().default("case_open"),
    reasonCode: text("reason_code").notNull(),
    priority: text("priority").notNull().default("P1"),
    requestedBy: text("requested_by").notNull(),
    requestedAt: text("requested_at").notNull(),
    responseDueAt: text("response_due_at").notNull(),
    targetArrivalAt: text("target_arrival_at"),
    acceptedAt: text("accepted_at"),
    arrivedAt: text("arrived_at"),
    closedAt: text("closed_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("relief_dispatches_slot_time_idx").on(table.rosterSlotId, table.requestedAt),
    index("relief_dispatches_site_status_idx").on(table.siteId, table.status),
    index("relief_dispatches_officer_status_idx").on(table.replacementOfficerId, table.status),
    uniqueIndex("relief_dispatches_active_slot_idx").on(table.activeKey),
  ],
);

export const reliefDispatchEvents = sqliteTable(
  "relief_dispatch_events",
  {
    id: text("id").primaryKey(),
    reliefDispatchId: text("relief_dispatch_id").notNull().references(() => reliefDispatches.id),
    eventType: text("event_type").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("relief_dispatch_events_dispatch_time_idx").on(table.reliefDispatchId, table.createdAt)],
);

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
    engagementModel: text("engagement_model").notNull().default("fixed"),
    noticeWindow: text("notice_window").notNull().default("standard"),
    rosterPattern: text("roster_pattern").notNull().default("monday_saturday"),
    calendarCategory: text("calendar_category").notNull().default("ordinary"),
    calendarLabel: text("calendar_label").notNull().default("Ordinary Monday–Saturday"),
    riskBand: text("risk_band").notNull().default("Standard"),
    riskScore: integer("risk_score").notNull().default(0),
    riskReasons: text("risk_reasons").notNull().default("[]"),
    requiredEndorsements: text("required_endorsements").notNull().default("[]"),
    manualReview: integer("manual_review").notNull().default(0),
    shiftCount: integer("shift_count").notNull().default(1),
    officerTotalCents: integer("officer_total_cents").notNull().default(0),
    grossPlatformContributionCents: integer("gross_platform_contribution_cents").notNull().default(0),
    pricingVersion: text("pricing_version").notNull().default("LOKD-PREMIUM-2026.09"),
    pricingBreakdown: text("pricing_breakdown").notNull().default("{}"),
    minimumGrade: text("minimum_grade").notNull(),
    contractMonths: integer("contract_months").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    shiftStart: text("shift_start").notNull(),
    shiftEnd: text("shift_end").notNull(),
    clientPriceCents: integer("client_price_cents").notNull(),
    officerRateCents: integer("officer_rate_cents").notNull(),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
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
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
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

export const bookingFundingReconciliations = sqliteTable(
  "booking_funding_reconciliations",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    expectedAmountCents: integer("expected_amount_cents").notNull(),
    clearedAmountCents: integer("cleared_amount_cents").notNull(),
    status: text("status").notNull().default("pending"),
    clearedAt: text("cleared_at"),
    reconciledAt: text("reconciled_at"),
    evidenceReference: text("evidence_reference"),
    evidenceVerifiedAt: text("evidence_verified_at"),
    evidenceExpiresAt: text("evidence_expires_at"),
    version: integer("version").notNull().default(1),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("funding_reconciliation_booking_idx").on(table.bookingId, table.status),
    uniqueIndex("funding_reconciliation_active_idx").on(table.activeKey),
    uniqueIndex("funding_reconciliation_provider_ref_idx").on(table.provider, table.providerReference),
  ],
);

export const siteRiskAssessments = sqliteTable(
  "site_risk_assessments",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    riskRulesVersion: text("risk_rules_version").notNull(),
    riskBand: text("risk_band").notNull(),
    status: text("status").notNull().default("draft"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    validFrom: text("valid_from"),
    expiresAt: text("expires_at"),
    version: integer("version").notNull().default(1),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("site_risk_site_status_idx").on(table.siteId, table.status),
    uniqueIndex("site_risk_active_idx").on(table.activeKey),
  ],
);

export const postOrderApprovals = sqliteTable(
  "post_order_approvals",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull().references(() => sitePosts.id),
    postOrdersVersion: text("post_orders_version").notNull(),
    status: text("status").notNull().default("draft"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    validFrom: text("valid_from"),
    expiresAt: text("expires_at"),
    version: integer("version").notNull().default(1),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("post_orders_post_status_idx").on(table.postId, table.status),
    uniqueIndex("post_orders_active_idx").on(table.activeKey),
  ],
);

export const officerSiteInductions = sqliteTable(
  "officer_site_inductions",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    inductionVersion: text("induction_version").notNull(),
    status: text("status").notNull().default("pending"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
    completedAt: text("completed_at"),
    expiresAt: text("expires_at"),
    version: integer("version").notNull().default(1),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("officer_induction_officer_site_idx").on(table.officerId, table.siteId, table.status),
    uniqueIndex("officer_induction_active_idx").on(table.activeKey),
  ],
);

export const workforceTermsAcceptances = sqliteTable(
  "workforce_terms_acceptances",
  {
    id: text("id").primaryKey(),
    workforceEngagementId: text("workforce_engagement_id").notNull().references(() => workforceEngagements.id),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    termsVersion: text("terms_version").notNull(),
    acceptanceMode: text("acceptance_mode").notNull(),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference").notNull(),
    acceptedAt: text("accepted_at").notNull(),
    expiresAt: text("expires_at"),
    version: integer("version").notNull().default(1),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("workforce_terms_engagement_idx").on(table.workforceEngagementId, table.acceptedAt),
    uniqueIndex("workforce_terms_active_idx").on(table.activeKey),
  ],
);

export const employerComplianceEvidence = sqliteTable(
  "employer_compliance_evidence",
  {
    id: text("id").primaryKey(),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    controlCode: text("control_code").notNull(),
    status: text("status").notNull().default("pending"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
    verifiedAt: text("verified_at"),
    expiresAt: text("expires_at"),
    version: integer("version").notNull().default(1),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("employer_evidence_employer_control_idx").on(table.employerId, table.controlCode, table.status),
    uniqueIndex("employer_evidence_active_idx").on(table.activeKey),
  ],
);

export const officerWorkCommitments = sqliteTable(
  "officer_work_commitments",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceReference: text("source_reference").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    status: text("status").notNull().default("declared"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference"),
    verifiedAt: text("verified_at"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("officer_commitments_window_idx").on(table.officerId, table.startsAt, table.endsAt, table.status)],
);

export const officerScheduleDeclarations = sqliteTable(
  "officer_schedule_declarations",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    evidenceReference: text("evidence_reference").notNull(),
    declaredAt: text("declared_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    supersedesId: text("supersedes_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("officer_schedule_declarations_version_idx").on(table.officerId, table.environment, table.version),
    index("officer_schedule_declarations_status_idx").on(table.officerId, table.environment, table.status, table.declaredAt),
  ],
);

export const officerTravelAssessments = sqliteTable(
  "officer_travel_assessments",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id, { onDelete: "cascade" }),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    status: text("status").notNull().default("pending"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    estimatedMinutes: integer("estimated_minutes"),
    source: text("source").notNull(),
    evidenceReference: text("evidence_reference"),
    assessedAt: text("assessed_at"),
    validUntil: text("valid_until"),
    version: integer("version").notNull().default(1),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("travel_assessment_officer_site_idx").on(table.officerId, table.siteId, table.status),
    uniqueIndex("travel_assessment_active_idx").on(table.activeKey),
  ],
);

export const activationEvidenceEpoch = sqliteTable(
  "activation_evidence_epoch",
  {
    singleton: integer("singleton").primaryKey(),
    revision: integer("revision").notNull().default(1),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const assignmentActivationCommands = sqliteTable(
  "assignment_activation_commands",
  {
    id: text("id").primaryKey(),
    activationKey: text("activation_key").notNull(),
    requestHash: text("request_hash").notNull(),
    rosterSlotId: text("roster_slot_id").notNull().references(() => rosterSlots.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    expectedSlotVersion: integer("expected_slot_version").notNull(),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    state: text("state").notNull().default("reserved"),
    rosterAssignmentId: text("roster_assignment_id").references(() => rosterAssignments.id),
    shiftId: text("shift_id").references(() => shifts.id),
    requestedBy: text("requested_by").notNull(),
    requestedAt: text("requested_at").notNull(),
    completedAt: text("completed_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("activation_commands_key_idx").on(table.activationKey),
    index("activation_commands_slot_state_idx").on(table.rosterSlotId, table.state),
    index("activation_commands_officer_state_idx").on(table.officerId, table.state),
  ],
);

export const assignmentEvidenceTokens = sqliteTable(
  "assignment_evidence_tokens",
  {
    id: text("id").primaryKey(),
    commandId: text("command_id").notNull().references(() => assignmentActivationCommands.id),
    checkpoint: text("checkpoint").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    evaluationHash: text("evaluation_hash").notNull(),
    evaluatedAt: text("evaluated_at").notNull(),
    rosterSlotId: text("roster_slot_id").notNull().references(() => rosterSlots.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    expectedSlotVersion: integer("expected_slot_version").notNull(),
    environment: text("environment").notNull(),
    fundingEvidence: text("funding_evidence").notNull(),
    siteEvidence: text("site_evidence").notNull(),
    launchEvidence: text("launch_evidence").notNull(),
    officerEvidence: text("officer_evidence").notNull(),
    employerEvidence: text("employer_evidence").notNull(),
    scheduleEvidence: text("schedule_evidence").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("assignment_evidence_tokens_command_checkpoint_idx").on(table.commandId, table.checkpoint),
    index("assignment_evidence_tokens_source_revision_idx").on(table.sourceRevision, table.createdAt),
  ],
);

export const assignmentActivationDecisions = sqliteTable(
  "assignment_activation_decisions",
  {
    id: text("id").primaryKey(),
    commandId: text("command_id").notNull().references(() => assignmentActivationCommands.id),
    sequence: integer("sequence").notNull(),
    checkpoint: text("checkpoint").notNull(),
    decision: text("decision").notNull(),
    environment: text("environment").notNull(),
    summary: text("summary").notNull(),
    evaluationHash: text("evaluation_hash").notNull(),
    evaluatedAt: text("evaluated_at").notNull(),
  },
  (table) => [
    uniqueIndex("activation_decisions_command_sequence_idx").on(table.commandId, table.sequence),
    index("activation_decisions_checkpoint_idx").on(table.checkpoint, table.evaluatedAt),
  ],
);

export const assignmentActivationBlockers = sqliteTable(
  "assignment_activation_blockers",
  {
    id: text("id").primaryKey(),
    decisionId: text("decision_id").notNull().references(() => assignmentActivationDecisions.id),
    code: text("code").notNull(),
    category: text("category").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("activation_blockers_decision_code_idx").on(table.decisionId, table.code),
    index("activation_blockers_code_idx").on(table.code, table.createdAt),
  ],
);

export const assignmentActivationSnapshots = sqliteTable(
  "assignment_activation_snapshots",
  {
    id: text("id").primaryKey(),
    commandId: text("command_id").notNull().references(() => assignmentActivationCommands.id),
    rosterAssignmentId: text("roster_assignment_id").notNull().references(() => rosterAssignments.id),
    shiftId: text("shift_id").notNull().references(() => shifts.id),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    clientId: text("client_id").notNull().references(() => clients.id),
    siteId: text("site_id").notNull().references(() => operationalSites.id),
    siteVersion: integer("site_version").notNull(),
    postId: text("post_id").notNull().references(() => sitePosts.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    fundingReconciliationId: text("funding_reconciliation_id").notNull().references(() => bookingFundingReconciliations.id),
    riskAssessmentId: text("risk_assessment_id").notNull().references(() => siteRiskAssessments.id),
    postOrderApprovalId: text("post_order_approval_id").notNull().references(() => postOrderApprovals.id),
    inductionId: text("induction_id").notNull().references(() => officerSiteInductions.id),
    workforceEngagementId: text("workforce_engagement_id").notNull().references(() => workforceEngagements.id),
    workforceModel: text("workforce_model").notNull(),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    employerLegalName: text("employer_legal_name").notNull(),
    employerVersion: integer("employer_version").notNull(),
    termsAcceptanceId: text("terms_acceptance_id").notNull().references(() => workforceTermsAcceptances.id),
    termsVersion: text("terms_version").notNull(),
    pricingVersion: text("pricing_version").notNull(),
    calendarCategory: text("calendar_category").notNull(),
    ordinaryWageCents: integer("ordinary_wage_cents").notNull(),
    holidayPremiumCents: integer("holiday_premium_cents").notNull(),
    statutoryCostCents: integer("statutory_cost_cents").notNull(),
    fundedOfferCents: integer("funded_offer_cents").notNull(),
    reservedMinutes: integer("reserved_minutes").notNull(),
    shiftStartsAt: text("shift_starts_at").notNull(),
    shiftEndsAt: text("shift_ends_at").notNull(),
    fundingEvidence: text("funding_evidence").notNull(),
    siteEvidence: text("site_evidence").notNull(),
    launchEvidence: text("launch_evidence").notNull(),
    officerEvidence: text("officer_evidence").notNull(),
    employerEvidence: text("employer_evidence").notNull(),
    scheduleEvidence: text("schedule_evidence").notNull(),
    evidenceValidThrough: text("evidence_valid_through").notNull(),
    final: integer("final").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("activation_snapshots_command_idx").on(table.commandId),
    uniqueIndex("activation_snapshots_assignment_idx").on(table.rosterAssignmentId),
    uniqueIndex("activation_snapshots_shift_idx").on(table.shiftId),
  ],
);

export const workforceHourReservations = sqliteTable(
  "workforce_hour_reservations",
  {
    id: text("id").primaryKey(),
    commandId: text("command_id").references(() => assignmentActivationCommands.id),
    rosterAssignmentId: text("roster_assignment_id").references(() => rosterAssignments.id),
    reliefDispatchId: text("relief_dispatch_id").references(() => reliefDispatches.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    workforceEngagementId: text("workforce_engagement_id").notNull().references(() => workforceEngagements.id),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    isoWeekStart: text("iso_week_start").notNull(),
    isoWeekEnd: text("iso_week_end").notNull(),
    segmentStartsAt: text("segment_starts_at").notNull(),
    segmentEndsAt: text("segment_ends_at").notNull(),
    reservedMinutes: integer("reserved_minutes").notNull(),
    weeklyCapMinutes: integer("weekly_cap_minutes").notNull(),
    status: text("status").notNull().default("active"),
    activeKey: text("active_key"),
    createdAt: text("created_at").notNull(),
    releasedAt: text("released_at"),
    releaseReason: text("release_reason"),
  },
  (table) => [
    index("hour_reservations_officer_week_idx").on(table.officerId, table.isoWeekStart, table.status),
    index("hour_reservations_assignment_idx").on(table.rosterAssignmentId, table.status),
    index("hour_reservations_relief_idx").on(table.reliefDispatchId, table.status),
    uniqueIndex("hour_reservations_active_idx").on(table.activeKey),
  ],
);

export const assignmentRevalidations = sqliteTable(
  "assignment_revalidations",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id").notNull().references(() => assignmentActivationSnapshots.id),
    checkpoint: text("checkpoint").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status").notNull().default("pending"),
    decisionId: text("decision_id").references(() => assignmentActivationDecisions.id),
    evaluatedAt: text("evaluated_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("assignment_revalidations_snapshot_checkpoint_idx").on(table.snapshotId, table.checkpoint),
    index("assignment_revalidations_status_time_idx").on(table.status, table.scheduledAt),
  ],
);
