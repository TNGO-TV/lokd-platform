import { sql } from "drizzle-orm";
import { index, integer, real, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const specialistCommercialReviews = sqliteTable("specialist_commercial_reviews", {
  id: text("id").primaryKey(),
  environment: text("environment").notNull(), integrityState: text("integrity_state").notNull(),
  pricingVersion: text("pricing_version").notNull(), termsVersion: text("terms_version").notNull(),
  status: text("status").notNull().default("review"), version: integer("version").notNull().default(1),
  evidenceReference: text("evidence_reference").notNull(), expiresAt: text("expires_at").notNull(),
  preparedBy: text("prepared_by").notNull(), approvedBy: text("approved_by"), approvedAt: text("approved_at"),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("specialist_commercial_env_version_idx").on(table.environment, table.pricingVersion, table.termsVersion)]);

export const specialistPartners = sqliteTable("specialist_partners", {
  id: text("id").primaryKey(), name: text("name").notNull(), serviceCodes: text("service_codes").notNull(),
  environment: text("environment").notNull(), integrityState: text("integrity_state").notNull(),
  evidenceReference: text("evidence_reference").notNull(), validFrom: text("valid_from").notNull(), expiresAt: text("expires_at").notNull(),
  status: text("status").notNull().default("review"), version: integer("version").notNull().default(1),
  preparedBy: text("prepared_by").notNull(), approvedBy: text("approved_by"), approvedAt: text("approved_at"), updatedAt: text("updated_at").notNull(),
}, table => [index("specialist_partner_env_idx").on(table.environment, table.status)]);

export const specialistDeploymentPacks = sqliteTable("specialist_deployment_packs", {
  id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id, {onDelete:"cascade"}),
  environment: text("environment").notNull(), integrityState: text("integrity_state").notNull(),
  status: text("status").notNull().default("draft"), version: integer("version").notNull().default(1),
  content: text("content").notNull(), quoteSnapshot: text("quote_snapshot").notNull(),
  commercialReviewId: text("commercial_review_id").references(() => specialistCommercialReviews.id),
  commercialReviewVersion: integer("commercial_review_version").notNull().default(0),
  partnerId: text("partner_id").references(() => specialistPartners.id), partnerVersion: integer("partner_version").notNull().default(0),
  preparedBy: text("prepared_by").notNull(), approvedBy: text("approved_by"), approvedAt: text("approved_at"),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("specialist_pack_booking_idx").on(table.bookingId),index("specialist_pack_queue_idx").on(table.environment,table.status)]);

export const specialistRehearsalRuns = sqliteTable("specialist_rehearsal_runs", {
  id: text("id").primaryKey(), environment: text("environment").notNull().default("demo"),
  integrityState: text("integrity_state").notNull().default("synthetic"),
  scenarios: text("scenarios").notNull(), runBy: text("run_by").notNull(), createdAt: text("created_at").notNull(),
}, table => [index("specialist_rehearsal_date_idx").on(table.environment,table.createdAt)]);

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
    identityConsentVersion: text("identity_consent_version"),
    identityConsentedAt: text("identity_consented_at"),
    convertedOfficerId: text("officer_id").references(() => officers.id, { onDelete: "set null" }),
    environment: text("environment").notNull().default("prelaunch"),
    integrityState: text("integrity_state").notNull().default("user_submitted"),
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
  permanentEngagementClauseVersion: text("permanent_engagement_clause_version").notNull().default("ZA-PERMANENT-ENGAGEMENT-2026-01"),
  permanentEngagementClauseStatus: text("permanent_engagement_clause_status").notNull().default("pending_acknowledgement"),
  permanentEngagementClauseAcknowledgedAt: text("permanent_engagement_clause_acknowledged_at"),
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

export const officerConversionCases = sqliteTable(
  "officer_conversion_cases",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    workforceEngagementId: text("workforce_engagement_id").references(() => workforceEngagements.id, { onDelete: "set null" }),
    route: text("route").notNull(),
    status: text("status").notNull().default("enquiry"),
    activeKey: text("active_key"),
    officerGrade: text("officer_grade").notNull(),
    specialistCategory: text("specialist_category").notNull().default("standard"),
    completedServiceMonths: integer("completed_service_months").notNull().default(0),
    annualGuaranteedCashCents: integer("annual_guaranteed_cash_cents"),
    minimumFeeCents: integer("minimum_fee_cents").notNull(),
    tenurePercent: integer("tenure_percent").notNull(),
    percentageFeeCents: integer("percentage_fee_cents"),
    calculatedFeeCents: integer("calculated_fee_cents").notNull(),
    policyVersion: text("policy_version").notNull(),
    clauseVersion: text("clause_version").notNull(),
    clauseStatus: text("clause_status").notNull().default("pending_acknowledgement"),
    clientEmployerPackStatus: text("client_employer_pack_status").notNull().default("pending"),
    lokdPayrollCloseoutStatus: text("lokd_payroll_closeout_status").notNull().default("pending"),
    psiraTransferStatus: text("psira_transfer_status").notNull().default("pending"),
    feeStatus: text("fee_status").notNull().default("quoted"),
    offerNotifiedAt: text("offer_notified_at"),
    offerAcceptedAt: text("offer_accepted_at"),
    employmentStartsAt: text("employment_starts_at"),
    finalAssignmentAt: text("final_assignment_at"),
    protectionEndsAt: text("protection_ends_at"),
    completedAt: text("completed_at"),
    ownerId: text("owner_id").notNull(),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("officer_conversion_active_idx").on(table.activeKey),
    index("officer_conversion_client_status_idx").on(table.clientId, table.status),
    index("officer_conversion_officer_status_idx").on(table.officerId, table.status),
    index("officer_conversion_queue_idx").on(table.environment, table.status, table.updatedAt),
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
    postOrdersContent: text("post_orders_content").notNull().default(""),
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
    positionIndex: integer("position_index").notNull().default(1),
    calendarCategory: text("calendar_category").notNull().default("ordinary"),
    officerOfferCents: integer("officer_offer_cents").notNull().default(0),
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
    uniqueIndex("roster_slots_booking_post_date_position_idx").on(
      table.bookingId,
      table.postId,
      table.serviceDate,
      table.positionIndex,
    ),
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
    contractingEntityId: text('contracting_entity_id'),
    agreementVersion: integer('agreement_version').notNull().default(1),
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
    headcount: integer("headcount").notNull().default(1),
    serviceDayCount: integer("service_day_count").notNull().default(1),
    shiftCount: integer("shift_count").notNull().default(1),
    officerTotalCents: integer("officer_total_cents").notNull().default(0),
    grossPlatformContributionCents: integer("gross_platform_contribution_cents").notNull().default(0),
    pricingVersion: text("pricing_version").notNull().default("LOKD-PREMIUM-2026.09"),
    pricingBreakdown: text("pricing_breakdown").notNull().default("{}"),
    specialistServiceCode: text("specialist_service_code").notNull().default("standard_unarmed"),
    specialistConfiguration: text("specialist_configuration").notNull().default("{}"),
    quoteSubtotalCents: integer("quote_subtotal_cents").notNull().default(0),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull().default(1_500),
    vatCents: integer("vat_cents").notNull().default(0),
    costFloorCents: integer("cost_floor_cents").notNull().default(0),
    marginCents: integer("margin_cents").notNull().default(0),
    marginBasisPoints: integer("margin_basis_points").notNull().default(0),
    minimumMarginBasisPoints: integer("minimum_margin_basis_points").notNull().default(0),
    pricingStatus: text("pricing_status").notNull().default("legacy"),
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
    fundingModel: text("funding_model").notNull().default("advance_only"),
    creditTermsDays: integer("credit_terms_days").notNull().default(0),
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
    positionIndex: integer("position_index").notNull().default(1),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("open"),
    expiresAt: text("expires_at").notNull(),
    respondedAt: text("responded_at"),
  },
  (table) => [
    index("offers_officer_idx").on(table.officerId),
    index("offers_booking_idx").on(table.bookingId),
    uniqueIndex("offers_one_accepted_per_booking_position_idx")
      .on(table.bookingId, table.positionIndex)
      .where(sql`${table.status} = 'accepted'`),
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

export const shiftTimesheets = sqliteTable(
  "shift_timesheets",
  {
    id: text("id").primaryKey(),
    shiftId: text("shift_id").notNull().references(() => shifts.id),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    rosterAssignmentId: text("roster_assignment_id").references(() => rosterAssignments.id),
    activationSnapshotId: text("activation_snapshot_id").references(() => assignmentActivationSnapshots.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    workforceEngagementId: text("workforce_engagement_id").references(() => workforceEngagements.id),
    employerId: text("employer_id").references(() => workforceEmployers.id),
    workforceModel: text("workforce_model"),
    serviceDate: text("service_date").notNull(),
    scheduledStartsAt: text("scheduled_starts_at").notNull(),
    scheduledEndsAt: text("scheduled_ends_at").notNull(),
    checkInAt: text("check_in_at"),
    checkOutAt: text("check_out_at"),
    scheduledMinutes: integer("scheduled_minutes").notNull(),
    recordedMinutes: integer("recorded_minutes").notNull(),
    payableMinutes: integer("payable_minutes"),
    grossWageCents: integer("gross_wage_cents").notNull(),
    calendarCategory: text("calendar_category").notNull(),
    policyVersion: text("policy_version").notNull(),
    clientEvidenceStatus: text("client_evidence_status").notNull().default("pending"),
    operationsStatus: text("operations_status").notNull().default("awaiting_review"),
    evidenceReference: text("evidence_reference"),
    evidenceHash: text("evidence_hash"),
    exceptionReason: text("exception_reason"),
    supersedesId: text("supersedes_id"),
    activeKey: text("active_key"),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    submittedAt: text("submitted_at").notNull(),
    lockedAt: text("locked_at"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("shift_timesheets_active_idx").on(table.activeKey),
    index("shift_timesheets_shift_idx").on(table.shiftId, table.version),
    index("shift_timesheets_review_idx").on(table.environment, table.operationsStatus, table.serviceDate),
    index("shift_timesheets_officer_idx").on(table.officerId, table.serviceDate),
  ],
);

export const payrollProfiles = sqliteTable(
  "payroll_profiles",
  {
    id: text("id").primaryKey(),
    officerId: text("officer_id").notNull().references(() => officers.id),
    workforceEngagementId: text("workforce_engagement_id").notNull().references(() => workforceEngagements.id),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    taxReferenceToken: text("tax_reference_token"),
    uifReferenceToken: text("uif_reference_token"),
    providentReferenceToken: text("provident_reference_token"),
    paymentDestinationToken: text("payment_destination_token"),
    status: text("status").notNull().default("pending_verification"),
    evidenceReference: text("evidence_reference"),
    evidenceVerifiedAt: text("evidence_verified_at"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    activeKey: text("active_key"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("payroll_profiles_active_idx").on(table.activeKey),
    index("payroll_profiles_officer_idx").on(table.officerId, table.status),
  ],
);

export const payrollRuns = sqliteTable(
  "payroll_runs",
  {
    id: text("id").primaryKey(),
    batchKey: text("batch_key").notNull(),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    payDate: text("pay_date").notNull(),
    runType: text("run_type").notNull().default("regular"),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("awaiting_backend_calculation"),
    grossCents: integer("gross_cents").notNull(),
    employeeDeductionCents: integer("employee_deduction_cents"),
    netPayCents: integer("net_pay_cents"),
    employerCostCents: integer("employer_cost_cents"),
    itemCount: integer("item_count").notNull(),
    policyVersion: text("policy_version"),
    calculationVersion: text("calculation_version"),
    exportReference: text("export_reference"),
    payslipBundleReference: text("payslip_bundle_reference"),
    settlementReference: text("settlement_reference"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    secondApprovedBy: text("second_approved_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    approvedAt: text("approved_at"),
    exportedAt: text("exported_at"),
    settledAt: text("settled_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("payroll_runs_batch_idx").on(table.environment, table.integrityState, table.batchKey),
    index("payroll_runs_period_idx").on(table.environment, table.status, table.periodStart, table.periodEnd),
  ],
);

export const payrollItems = sqliteTable(
  "payroll_items",
  {
    id: text("id").primaryKey(),
    payrollRunId: text("payroll_run_id").notNull().references(() => payrollRuns.id),
    officerId: text("officer_id").notNull().references(() => officers.id),
    payrollProfileId: text("payroll_profile_id").references(() => payrollProfiles.id),
    workforceEngagementId: text("workforce_engagement_id").notNull().references(() => workforceEngagements.id),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    workforceModel: text("workforce_model").notNull(),
    grossWageCents: integer("gross_wage_cents").notNull(),
    employeeDeductionCents: integer("employee_deduction_cents"),
    netPayCents: integer("net_pay_cents"),
    employerCostCents: integer("employer_cost_cents"),
    status: text("status").notNull().default("awaiting_backend_calculation"),
    policyVersion: text("policy_version"),
    payslipReference: text("payslip_reference"),
    settlementReference: text("settlement_reference"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("payroll_items_run_officer_idx").on(table.payrollRunId, table.officerId),
    index("payroll_items_run_idx").on(table.payrollRunId),
    index("payroll_items_officer_idx").on(table.officerId, table.status),
  ],
);

export const payItemSources = sqliteTable(
  "pay_item_sources",
  {
    id: text("id").primaryKey(),
    payrollItemId: text("payroll_item_id").notNull().references(() => payrollItems.id),
    timesheetId: text("timesheet_id").notNull().references(() => shiftTimesheets.id),
    timesheetVersion: integer("timesheet_version").notNull(),
    payableMinutes: integer("payable_minutes").notNull(),
    grossWageCents: integer("gross_wage_cents").notNull(),
    activeKey: text("active_key"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("pay_item_sources_active_idx").on(table.activeKey),
    index("pay_item_sources_item_idx").on(table.payrollItemId),
  ],
);

export const payItemLines = sqliteTable(
  "pay_item_lines",
  {
    id: text("id").primaryKey(),
    payrollItemId: text("payroll_item_id").notNull().references(() => payrollItems.id),
    lineType: text("line_type").notNull(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    quantityMinutes: integer("quantity_minutes"),
    rateCents: integer("rate_cents"),
    rateBasisPoints: integer("rate_basis_points"),
    statutoryCode: text("statutory_code"),
    ruleVersion: text("rule_version").notNull(),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("pay_item_lines_item_idx").on(table.payrollItemId, table.lineType)],
);

export const documentArtifacts = sqliteTable(
  "document_artifacts",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    storageReference: text("storage_reference").notNull(),
    contentHash: text("content_hash").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    retentionClass: text("retention_class").notNull(),
    accessClass: text("access_class").notNull(),
    status: text("status").notNull().default("pending"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    verifiedAt: text("verified_at"),
  },
  (table) => [
    uniqueIndex("document_artifacts_storage_idx").on(table.environment, table.storageReference),
    index("document_artifacts_kind_idx").on(table.environment, table.kind, table.status),
  ],
);

export const payslips = sqliteTable(
  "payslips",
  {
    id: text("id").primaryKey(),
    payrollItemId: text("payroll_item_id").notNull().references(() => payrollItems.id),
    artifactId: text("artifact_id").notNull().references(() => documentArtifacts.id),
    documentVersion: integer("document_version").notNull().default(1),
    status: text("status").notNull().default("generated"),
    supersedesId: text("supersedes_id"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    generatedAt: text("generated_at").notNull(),
    issuedAt: text("issued_at"),
  },
  (table) => [
    uniqueIndex("payslips_item_version_idx").on(table.payrollItemId, table.documentVersion),
    index("payslips_issue_idx").on(table.environment, table.status),
  ],
);

export const disbursementBatches = sqliteTable(
  "disbursement_batches",
  {
    id: text("id").primaryKey(),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    rail: text("rail").notNull().default("eft"),
    currency: text("currency").notNull().default("ZAR"),
    itemCount: integer("item_count").notNull(),
    totalCents: integer("total_cents").notNull(),
    status: text("status").notNull().default("draft"),
    providerReference: text("provider_reference"),
    evidenceReference: text("evidence_reference"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    settledAt: text("settled_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [index("disbursement_batches_status_idx").on(table.environment, table.status)],
);

export const disbursementItems = sqliteTable(
  "disbursement_items",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull().references(() => disbursementBatches.id),
    payrollItemId: text("payroll_item_id").references(() => payrollItems.id),
    partnerPayableId: text("partner_payable_id"),
    destinationToken: text("destination_token").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("draft"),
    providerReference: text("provider_reference"),
    clearingEvidenceReference: text("clearing_evidence_reference"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    settledAt: text("settled_at"),
  },
  (table) => [
    uniqueIndex("disbursement_items_payroll_idx").on(table.payrollItemId),
    index("disbursement_items_batch_idx").on(table.batchId, table.status),
  ],
);

export const partnerPayables = sqliteTable(
  "partner_payables",
  {
    id: text("id").primaryKey(),
    timesheetId: text("timesheet_id").notNull().references(() => shiftTimesheets.id),
    employerId: text("employer_id").notNull().references(() => workforceEmployers.id),
    serviceAgreementVersion: text("service_agreement_version").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("approved"),
    remittanceReference: text("remittance_reference"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("partner_payables_timesheet_idx").on(table.timesheetId),
    index("partner_payables_employer_idx").on(table.employerId, table.status),
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

export const integrationProviderConfigs = sqliteTable(
  "integration_provider_configs",
  {
    key: text("key").primaryKey(),
    capability: text("capability").notNull(),
    provider: text("provider").notNull(),
    mode: text("mode").notNull().default("disabled"),
    status: text("status").notNull().default("not_connected"),
    requiredForPilot: integer("required_for_pilot").notNull().default(1),
    configurationVersion: text("configuration_version").notNull().default("unconfigured"),
    capabilities: text("capabilities").notNull().default("[]"),
    detail: text("detail").notNull().default(""),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    lastHealthState: text("last_health_state").notNull().default("unknown"),
    lastHealthCheckedAt: text("last_health_checked_at"),
    lastEventAt: text("last_event_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("integration_provider_capability_env_idx").on(table.capability, table.environment),
    index("integration_provider_status_idx").on(table.environment, table.status),
  ],
);

export const apiIdempotencyKeys = sqliteTable(
  "api_idempotency_keys",
  {
    id: text("id").primaryKey(),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    responseStatus: integer("response_status"),
    responseReference: text("response_reference"),
    environment: text("environment").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("api_idempotency_principal_key_idx").on(table.principalType, table.principalId, table.operation, table.environment, table.idempotencyKey),
    index("api_idempotency_expiry_idx").on(table.expiresAt),
  ],
);

export const integrationOperations = sqliteTable(
  "integration_operations",
  {
    id: text("id").primaryKey(),
    providerKey: text("provider_key").notNull().references(() => integrationProviderConfigs.key),
    capability: text("capability").notNull(),
    operationType: text("operation_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    providerReference: text("provider_reference"),
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: text("next_attempt_at"),
    lastErrorCode: text("last_error_code"),
    lastErrorDetail: text("last_error_detail"),
    environment: text("environment").notNull().default("demo"),
    integrityState: text("integrity_state").notNull().default("synthetic"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("integration_operations_idempotency_idx").on(table.providerKey, table.environment, table.idempotencyKey),
    index("integration_operations_state_idx").on(table.environment, table.state, table.nextAttemptAt),
    index("integration_operations_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const providerWebhookInbox = sqliteTable(
  "provider_webhook_inbox",
  {
    id: text("id").primaryKey(),
    providerKey: text("provider_key").notNull().references(() => integrationProviderConfigs.key),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    rawBodyHash: text("raw_body_hash").notNull(),
    rawBodyArtifactId: text("raw_body_artifact_id").references(() => documentArtifacts.id),
    payloadSchema: text("payload_schema").notNull().default("provider-event-v1"),
    correlationKey: text("correlation_key"),
    signatureState: text("signature_state").notNull().default("unverified"),
    processingState: text("processing_state").notNull().default("received"),
    attempts: integer("attempts").notNull().default(0),
    operationId: text("operation_id").references(() => integrationOperations.id),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    receivedAt: text("received_at").notNull(),
    processedAt: text("processed_at"),
    lastErrorCode: text("last_error_code"),
  },
  (table) => [
    uniqueIndex("provider_webhook_event_idx").on(table.providerKey, table.environment, table.providerEventId),
    index("provider_webhook_processing_idx").on(table.environment, table.processingState, table.receivedAt),
  ],
);

export const domainOutboxEvents = sqliteTable(
  "domain_outbox_events",
  {
    id: text("id").primaryKey(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    payloadVersion: text("payload_version").notNull(),
    payloadJson: text("payload_json"),
    payloadArtifactId: text("payload_artifact_id").references(() => documentArtifacts.id),
    correlationKey: text("correlation_key"),
    idempotencyKey: text("idempotency_key"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: text("available_at").notNull(),
    nextAttemptAt: text("next_attempt_at"),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: text("lease_expires_at"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    dispatchedAt: text("dispatched_at"),
    deadLetteredAt: text("dead_lettered_at"),
    lastErrorCode: text("last_error_code"),
  },
  (table) => [
    index("domain_outbox_dispatch_idx").on(table.environment, table.status, table.availableAt),
    index("domain_outbox_aggregate_idx").on(table.aggregateType, table.aggregateId, table.createdAt),
  ],
);

export const identityVerificationCases = sqliteTable(
  "identity_verification_cases",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id").references(() => officerApplications.id, { onDelete: "set null" }),
    officerId: text("officer_id").references(() => officers.id, { onDelete: "set null" }),
    providerKey: text("provider_key").notNull().references(() => integrationProviderConfigs.key),
    providerReference: text("provider_reference"),
    status: text("status").notNull().default("created"),
    decision: text("decision"),
    consentVersion: text("consent_version").notNull(),
    consentedAt: text("consented_at").notNull(),
    checks: text("checks").notNull().default("[]"),
    reasonCodes: text("reason_codes").notNull().default("[]"),
    evidenceReference: text("evidence_reference"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("identity_cases_application_idx").on(table.applicationId, table.status),
    index("identity_cases_officer_idx").on(table.officerId, table.status),
    index("identity_cases_provider_ref_idx").on(table.providerKey, table.providerReference),
    uniqueIndex("identity_cases_provider_ref_unique_v21")
      .on(table.providerKey, table.environment, table.providerReference)
      .where(sql`${table.providerReference} IS NOT NULL`),
  ],
);

export const paymentOrders = sqliteTable(
  "payment_orders",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull().references(() => clients.id),
    providerKey: text("provider_key").notNull().references(() => integrationProviderConfigs.key),
    providerReference: text("provider_reference"),
    currency: text("currency").notNull().default("ZAR"),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("created"),
    idempotencyKey: text("idempotency_key").notNull(),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    authorisedAt: text("authorised_at"),
    clearedAt: text("cleared_at"),
    reconciledAt: text("reconciled_at"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("payment_orders_idempotency_idx").on(table.providerKey, table.environment, table.idempotencyKey),
    uniqueIndex("payment_orders_provider_ref_unique_v21")
      .on(table.providerKey, table.environment, table.providerReference)
      .where(sql`${table.providerReference} IS NOT NULL`),
    index("payment_orders_booking_idx").on(table.bookingId, table.status),
    index("payment_orders_client_idx").on(table.clientId, table.status),
  ],
);

export const billingProfiles = sqliteTable(
  "billing_profiles",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    legalName: text("legal_name").notNull(),
    registrationNumber: text("registration_number"),
    vatNumber: text("vat_number"),
    taxStatus: text("tax_status").notNull().default("pending_configuration"),
    billingAddress: text("billing_address").notNull(),
    billingEmail: text("billing_email").notNull(),
    paymentTermsDays: integer("payment_terms_days").notNull().default(0),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    activeKey: text("active_key"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("billing_profiles_active_idx").on(table.activeKey),
    index("billing_profiles_owner_idx").on(table.ownerType, table.ownerId, table.version),
  ],
);

export const clientInvoices = sqliteTable(
  "client_invoices",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    clientId: text("client_id").notNull().references(() => clients.id),
    issuerBillingProfileId: text("issuer_billing_profile_id").references(() => billingProfiles.id),
    clientBillingProfileId: text("client_billing_profile_id").references(() => billingProfiles.id),
    artifactId: text("artifact_id").references(() => documentArtifacts.id),
    originalInvoiceId: text("original_invoice_id"),
    documentType: text("document_type").notNull().default("invoice"),
    invoiceNumber: text("invoice_number"),
    currency: text("currency").notNull().default("ZAR"),
    servicePeriodStart: text("service_period_start").notNull(),
    servicePeriodEnd: text("service_period_end").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents"),
    totalCents: integer("total_cents"),
    balanceCents: integer("balance_cents"),
    taxTreatment: text("tax_treatment").notNull().default("pending_configuration"),
    status: text("status").notNull().default("draft"),
    fundingStatus: text("funding_status").notNull().default("not_started"),
    pricingVersion: text("pricing_version").notNull(),
    issuerSnapshot: text("issuer_snapshot"),
    clientSnapshot: text("client_snapshot"),
    issueReference: text("issue_reference"),
    paymentReference: text("payment_reference"),
    dueAt: text("due_at"),
    issuedAt: text("issued_at"),
    settledAt: text("settled_at"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("client_invoices_number_idx").on(table.invoiceNumber),
    index("client_invoices_booking_idx").on(table.bookingId, table.status),
    index("client_invoices_status_idx").on(table.environment, table.status, table.createdAt),
    index("client_invoices_client_idx").on(table.clientId, table.createdAt),
  ],
);

export const clientInvoiceLines = sqliteTable(
  "client_invoice_lines",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull().references(() => clientInvoices.id),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    rosterSlotId: text("roster_slot_id").references(() => rosterSlots.id),
    timesheetId: text("timesheet_id").references(() => shiftTimesheets.id),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    netCents: integer("net_cents").notNull(),
    taxCents: integer("tax_cents"),
    grossCents: integer("gross_cents"),
    taxCode: text("tax_code").notNull().default("pending_configuration"),
    taxRateBasisPoints: integer("tax_rate_basis_points"),
    pricingVersion: text("pricing_version").notNull(),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("client_invoice_lines_invoice_idx").on(table.invoiceId)],
);

export const invoiceReceiptAllocations = sqliteTable(
  "invoice_receipt_allocations",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull().references(() => clientInvoices.id),
    paymentOrderId: text("payment_order_id").notNull().references(() => paymentOrders.id),
    fundingReconciliationId: text("funding_reconciliation_id").notNull().references(() => bookingFundingReconciliations.id),
    reversesAllocationId: text("reverses_allocation_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("allocated"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    allocatedAt: text("allocated_at").notNull(),
    reversedAt: text("reversed_at"),
  },
  (table) => [
    index("invoice_allocations_invoice_idx").on(table.invoiceId, table.status),
    index("invoice_allocations_payment_idx").on(table.paymentOrderId),
  ],
);

export const serviceRequests = sqliteTable(
  "service_requests",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    officerId: text("officer_id").references(() => officers.id, { onDelete: "set null" }),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    shiftId: text("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    requestedByRole: text("requested_by_role").notNull(),
    requestedById: text("requested_by_id").notNull(),
    category: text("category").notNull(),
    summary: text("summary").notNull(),
    detail: text("detail").notNull(),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("open"),
    ownerId: text("owner_id"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    resolvedAt: text("resolved_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("service_requests_status_idx").on(table.environment, table.status, table.createdAt),
    index("service_requests_client_idx").on(table.clientId, table.createdAt),
    index("service_requests_officer_idx").on(table.officerId, table.createdAt),
  ],
);

export const serviceHeartbeats = sqliteTable(
  "service_heartbeats",
  {
    key: text("key").primaryKey(),
    status: text("status").notNull(),
    environment: text("environment").notNull(),
    detail: text("detail").notNull().default(""),
    checkedAt: text("checked_at").notNull(),
    lastSuccessAt: text("last_success_at"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  },
  (table) => [index("service_heartbeats_status_idx").on(table.environment, table.status)],
);

export const platformReadinessControls = sqliteTable(
  "platform_readiness_controls",
  {
    code: text("code").primaryKey(),
    category: text("category").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("pending"),
    requiredForIntegrationReady: integer("required_for_integration_ready").notNull().default(1),
    evidenceReference: text("evidence_reference"),
    detail: text("detail").notNull().default(""),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    checkedAt: text("checked_at").notNull(),
    checkedBy: text("checked_by").notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("platform_readiness_status_idx").on(table.environment, table.status, table.category),
  ],
);

export const scheduledJobRuns = sqliteTable(
  "scheduled_job_runs",
  {
    id: text("id").primaryKey(),
    jobKey: text("job_key").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("running"),
    processedCount: integer("processed_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    detail: text("detail").notNull().default(""),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("scheduled_job_runs_status_idx").on(table.environment, table.jobKey, table.status, table.startedAt),
  ],
);

export const operatorNotifications = sqliteTable(
  "operator_notifications",
  {
    id: text("id").primaryKey(),
    sourceEventId: text("source_event_id").notNull().references(() => domainOutboxEvents.id),
    audienceRole: text("audience_role").notNull().default("operations"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("unread"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
    readAt: text("read_at"),
  },
  (table) => [
    uniqueIndex("operator_notifications_source_idx").on(table.sourceEventId),
    index("operator_notifications_queue_idx").on(table.environment, table.status, table.createdAt),
  ],
);

export const operatorAccounts = sqliteTable(
  "operator_accounts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("pending"),
    mfaStatus: text("mfa_status").notNull().default("not_verified"),
    mfaVerifiedAt: text("mfa_verified_at"),
    approvalLimitCents: integer("approval_limit_cents").notNull().default(0),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("operator_accounts_email_env_idx").on(table.email, table.environment),
    index("operator_accounts_status_idx").on(table.environment, table.status),
  ],
);

export const operatorRoleAssignments = sqliteTable(
  "operator_role_assignments",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id").notNull().references(() => operatorAccounts.id),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    grantedBy: text("granted_by").notNull(),
    grantedAt: text("granted_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("operator_role_active_idx").on(table.operatorId, table.role, table.environment),
    index("operator_role_queue_idx").on(table.environment, table.role, table.status),
  ],
);

export const operatorActionPolicies = sqliteTable(
  "operator_action_policies",
  {
    id: text("id").primaryKey(),
    actionCode: text("action_code").notNull(),
    label: text("label").notNull(),
    requiredRole: text("required_role").notNull(),
    mfaMaxAgeMinutes: integer("mfa_max_age_minutes").notNull(),
    maxAmountCents: integer("max_amount_cents"),
    secondApprovalRequired: integer("second_approval_required").notNull().default(0),
    status: text("status").notNull().default("active"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("operator_action_policy_code_idx").on(table.environment, table.actionCode),
    index("operator_action_policy_role_idx").on(table.environment, table.requiredRole, table.status),
  ],
);

export const operatorApprovalRequests = sqliteTable(
  "operator_approval_requests",
  {
    id: text("id").primaryKey(),
    actionCode: text("action_code").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    amountCents: integer("amount_cents").notNull().default(0),
    status: text("status").notNull().default("pending_first_approval"),
    requestedBy: text("requested_by").notNull().references(() => operatorAccounts.id),
    firstApprovedBy: text("first_approved_by").references(() => operatorAccounts.id),
    secondApprovedBy: text("second_approved_by").references(() => operatorAccounts.id),
    requestedAt: text("requested_at").notNull(),
    firstApprovedAt: text("first_approved_at"),
    secondApprovedAt: text("second_approved_at"),
    expiresAt: text("expires_at").notNull(),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("operator_approval_active_idx").on(table.environment, table.actionCode, table.aggregateId),
    index("operator_approval_queue_idx").on(table.environment, table.status, table.requestedAt),
  ],
);

export const payrollPolicyVersions = sqliteTable(
  "payroll_policy_versions",
  {
    id: text("id").primaryKey(),
    jurisdiction: text("jurisdiction").notNull().default("ZA"),
    currency: text("currency").notNull().default("ZAR"),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("draft"),
    rulesJson: text("rules_json").notNull(),
    policyHash: text("policy_hash").notNull(),
    sourceReference: text("source_reference").notNull(),
    activeKey: text("active_key"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdBy: text("created_by").notNull(),
    reviewedBy: text("reviewed_by"),
    approvedBy: text("approved_by"),
    createdAt: text("created_at").notNull(),
    reviewedAt: text("reviewed_at"),
    activatedAt: text("activated_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("payroll_policy_active_idx").on(table.activeKey),
    index("payroll_policy_effective_idx").on(table.environment, table.jurisdiction, table.status, table.effectiveFrom),
  ],
);

export const payrollShadowValidationRuns = sqliteTable(
  "payroll_shadow_validation_runs",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id").notNull().references(() => payrollPolicyVersions.id),
    policyHash: text("policy_hash").notNull(),
    engineVersion: text("engine_version").notNull(),
    status: text("status").notNull(),
    scenarioCount: integer("scenario_count").notNull(),
    passedCount: integer("passed_count").notNull(),
    failedCount: integer("failed_count").notNull(),
    resultJson: text("result_json").notNull(),
    resultHash: text("result_hash").notNull(),
    activationEligible: integer("activation_eligible").notNull().default(0),
    settlementLocked: integer("settlement_locked").notNull().default(1),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    runBy: text("run_by").notNull().references(() => operatorAccounts.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("payroll_shadow_validation_policy_idx").on(table.policyId, table.createdAt),
    index("payroll_shadow_validation_status_idx").on(table.environment, table.status, table.createdAt),
  ],
);

export const payrollExportPreviews = sqliteTable(
  "payroll_export_previews",
  {
    id: text("id").primaryKey(),
    payrollRunId: text("payroll_run_id").notNull().references(() => payrollRuns.id),
    exportType: text("export_type").notNull(),
    mimeType: text("mime_type").notNull(),
    contentHash: text("content_hash").notNull(),
    fileName: text("file_name").notNull(),
    rowCount: integer("row_count").notNull(),
    status: text("status").notNull().default("shadow_generated"),
    watermark: text("watermark").notNull().default("SHADOW ONLY - NOT FOR SUBMISSION OR PAYMENT"),
    createdBy: text("created_by").notNull().references(() => operatorAccounts.id),
    createdAt: text("created_at").notNull(),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("payroll_export_preview_run_type_idx").on(table.payrollRunId, table.exportType, table.version),
    index("payroll_export_preview_status_idx").on(table.environment, table.status, table.createdAt),
  ],
);

export const payrollExceptions = sqliteTable(
  "payroll_exceptions",
  {
    id: text("id").primaryKey(),
    payrollRunId: text("payroll_run_id").notNull().references(() => payrollRuns.id),
    code: text("code").notNull(),
    severity: text("severity").notNull(),
    detail: text("detail").notNull(),
    status: text("status").notNull().default("open"),
    evidenceReference: text("evidence_reference"),
    createdBy: text("created_by").notNull().references(() => operatorAccounts.id),
    resolvedBy: text("resolved_by").references(() => operatorAccounts.id),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("payroll_exceptions_queue_idx").on(table.environment, table.status, table.severity, table.createdAt),
    index("payroll_exceptions_run_idx").on(table.payrollRunId, table.status),
  ],
);

export const clientEnquiries = sqliteTable(
  "client_enquiries",
  {
    id: text("id").primaryKey(),
    organisationName: text("organisation_name").notNull(),
    contactName: text("contact_name").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    mobileNormalized: text("mobile_normalized"),
    siteArea: text("site_area").notNull(),
    siteType: text("site_type").notNull(),
    requiredStart: text("required_start").notNull(),
    message: text("message").notNull(),
    serviceType: text("service_type").notNull().default("scheduled_unarmed_fixed_site"),
    fundingModel: text("funding_model").notNull().default("advance_only"),
    creditTermsDays: integer("credit_terms_days").notNull().default(0),
    privacyNoticeVersion: text("privacy_notice_version").notNull(),
    privacyAcknowledgedAt: text("privacy_acknowledged_at").notNull(),
    status: text("status").notNull().default("new"),
    ownerId: text("owner_id"),
    resolution: text("resolution"),
    environment: text("environment").notNull().default("prelaunch"),
    integrityState: text("integrity_state").notNull().default("user_submitted"),
    retentionReviewAt: text("retention_review_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("client_enquiries_queue_idx").on(table.environment, table.status, table.createdAt),
    index("client_enquiries_email_idx").on(table.emailNormalized, table.createdAt),
  ],
);

export const onboardingCases = sqliteTable(
  "onboarding_cases",
  {
    id: text("id").primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    displayName: text("display_name").notNull(),
    contactEmailNormalized: text("contact_email_normalized").notNull(),
    status: text("status").notNull().default("draft"),
    currentStage: text("current_stage").notNull().default("details"),
    ownerId: text("owner_id").notNull().references(() => operatorAccounts.id),
    identityStatus: text("identity_status").notNull().default("pending"),
    complianceStatus: text("compliance_status").notNull().default("pending"),
    contractStatus: text("contract_status").notNull().default("pending"),
    bankingStatus: text("banking_status").notNull().default("not_required"),
    accessStatus: text("access_status").notNull().default("not_invited"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("onboarding_case_subject_idx").on(table.environment, table.subjectType, table.subjectId),
    index("onboarding_case_queue_idx").on(table.environment, table.status, table.updatedAt),
    index("onboarding_case_email_idx").on(table.contactEmailNormalized, table.status),
  ],
);

export const onboardingChecklistItems = sqliteTable(
  "onboarding_checklist_items",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull().references(() => onboardingCases.id),
    code: text("code").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    required: integer("required").notNull().default(1),
    status: text("status").notNull().default("pending"),
    evidenceReference: text("evidence_reference"),
    evidenceHash: text("evidence_hash"),
    verifiedBy: text("verified_by").references(() => operatorAccounts.id),
    verifiedAt: text("verified_at"),
    expiresAt: text("expires_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("onboarding_checklist_case_code_idx").on(table.caseId, table.code),
    index("onboarding_checklist_status_idx").on(table.environment, table.status, table.category),
  ],
);

export const contractTemplateVersions = sqliteTable(
  "contract_template_versions",
  {
    id: text("id").primaryKey(),
    templateCode: text("template_code").notNull(),
    label: text("label").notNull(),
    jurisdiction: text("jurisdiction").notNull().default("ZA"),
    templateVersion: text("template_version").notNull(),
    variableSchemaJson: text("variable_schema_json").notNull(),
    bodyReference: text("body_reference").notNull(),
    templateHash: text("template_hash").notNull(),
    status: text("status").notNull().default("draft"),
    watermark: text("watermark"),
    approvedBy: text("approved_by").references(() => operatorAccounts.id),
    approvedAt: text("approved_at"),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    activeKey: text("active_key"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("contract_template_version_idx").on(table.templateCode, table.templateVersion, table.environment),
    uniqueIndex("contract_template_active_idx").on(table.activeKey),
    index("contract_template_status_idx").on(table.environment, table.status, table.templateCode),
  ],
);

export const contractEnvelopes = sqliteTable(
  "contract_envelopes",
  {
    id: text("id").primaryKey(),
    onboardingCaseId: text("onboarding_case_id").notNull().references(() => onboardingCases.id),
    templateVersionId: text("template_version_id").notNull().references(() => contractTemplateVersions.id),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    variablesJson: text("variables_json").notNull(),
    variablesHash: text("variables_hash").notNull(),
    documentReference: text("document_reference").notNull(),
    documentHash: text("document_hash").notNull(),
    status: text("status").notNull().default("preview"),
    watermark: text("watermark"),
    generatedBy: text("generated_by").notNull().references(() => operatorAccounts.id),
    approvedBy: text("approved_by").references(() => operatorAccounts.id),
    signedByEmail: text("signed_by_email"),
    generatedAt: text("generated_at").notNull(),
    approvedAt: text("approved_at"),
    signedAt: text("signed_at"),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("contract_envelope_case_template_idx").on(table.onboardingCaseId, table.templateVersionId),
    index("contract_envelope_status_idx").on(table.environment, table.status, table.updatedAt),
    index("contract_envelope_subject_idx").on(table.subjectType, table.subjectId),
  ],
);

export const workspaceAccessInvitations = sqliteTable(
  "workspace_access_invitations",
  {
    id: text("id").primaryKey(),
    onboardingCaseId: text("onboarding_case_id").notNull().references(() => onboardingCases.id),
    emailNormalized: text("email_normalized").notNull(),
    role: text("role").notNull(),
    clientId: text("client_id").references(() => clients.id),
    officerId: text("officer_id").references(() => officers.id),
    operatorId: text("operator_id").references(() => operatorAccounts.id),
    status: text("status").notNull().default("prepared"),
    requestedBy: text("requested_by").notNull().references(() => operatorAccounts.id),
    approvedBy: text("approved_by").references(() => operatorAccounts.id),
    requestedAt: text("requested_at").notNull(),
    approvedAt: text("approved_at"),
    claimedAt: text("claimed_at"),
    activatedAt: text("activated_at"),
    expiresAt: text("expires_at").notNull(),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    activeKey: text("active_key"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("workspace_access_invitation_active_idx").on(table.activeKey),
    index("workspace_access_invitation_email_idx").on(table.emailNormalized, table.status),
    index("workspace_access_invitation_queue_idx").on(table.environment, table.status, table.updatedAt),
  ],
);

export const controlledPilotRehearsals = sqliteTable(
  "controlled_pilot_rehearsals",
  {
    id: text("id").primaryKey(),
    flowVersion: text("flow_version").notNull(),
    status: text("status").notNull(),
    stepsJson: text("steps_json").notNull(),
    stepsHash: text("steps_hash").notNull(),
    blockersJson: text("blockers_json").notNull(),
    creditTermsDays: integer("credit_terms_days").notNull().default(0),
    fundingModel: text("funding_model").notNull().default("advance_only"),
    settlementLocked: integer("settlement_locked").notNull().default(1),
    productionAuthorised: integer("production_authorised").notNull().default(0),
    runBy: text("run_by").notNull().references(() => operatorAccounts.id),
    environment: text("environment").notNull(),
    integrityState: text("integrity_state").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("controlled_pilot_rehearsal_status_idx").on(table.environment, table.status, table.createdAt),
  ],
);

// Genuine account-bound PSiRA reviews. Never seeded from public demo records.
export const psiraVerificationCases = sqliteTable("psira_verification_cases", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  psiraNumber: text("psira_number").notNull(),
  declaration: text("declaration").notNull().default("registered"),
  version: integer("version").notNull(),
  latestEventId: text("latest_event_id").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("psira_case_owner_idx").on(table.ownerUserId)]);

export const psiraVerificationEvents = sqliteTable("psira_verification_events", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => psiraVerificationCases.id),
  version: integer("version").notNull(),
  psiraNumber: text("psira_number").notNull(),
  declaration: text("declaration").notNull().default("registered"),
  kind: text("kind").notNull(),
  registrationStatus: text("registration_status").notNull(),
  identityMatch: text("identity_match").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  recordedBy: text("recorded_by").notNull(),
  recordedAt: text("recorded_at").notNull(),
  recheckAt: text("recheck_at"),
}, table => [uniqueIndex("psira_event_case_version_idx").on(table.caseId, table.version)]);

// Prepared signing integration; no public acceptance endpoint until legal approval.
export const agreementAcceptanceReceipts = sqliteTable('agreement_acceptance_receipts', {
  id: text('id').primaryKey(),
  receiptJson: text('receipt_json').notNull(),
  receiptHash: text('receipt_hash').notNull(),
  contextHash: text('context_hash').notNull(),
}, table => [index('agreement_receipt_context_idx').on(table.contextHash)]);

export const agreementReceiptRevocations = sqliteTable('agreement_receipt_revocations', {
  receiptId: text('receipt_id').primaryKey().references(() => agreementAcceptanceReceipts.id),
  reason: text('reason').notNull(),
  revokedBy: text('revoked_by').notNull(),
  revokedAt: text('revoked_at').notNull(),
});

// Production legal versions are separate from the intentionally demo-only envelopes.
export const agreementDocumentVersions = sqliteTable('agreement_document_versions', {
  id: text('id').primaryKey(),
  documentCode: text('document_code').notNull(),
  documentVersion: text('document_version').notNull(),
  entityId: text('entity_id').notNull(),
  locale: text('locale').notNull(),
  contentHash: text('content_hash').notNull(),
  documentReference: text('document_reference').notNull(),
  status: text('status').notNull(),
  approvedBy: text('approved_by').notNull(),
  approvedAt: text('approved_at').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  environment: text('environment').notNull(),
  integrityState: text('integrity_state').notNull(),
}, table => [uniqueIndex('agreement_document_version_idx').on(table.documentCode,table.documentVersion,table.entityId,table.locale)]);

// Signup-only review and account linking; never grants operational roles/eligibility.
export const signupCases = sqliteTable('signup_cases', {
  kind:text('kind').notNull(), sourceId:text('source_id').notNull(), ownerUserId:text('owner_user_id'),
  status:text('status').notNull(), publicNote:text('public_note').notNull(), correctionsJson:text('corrections_json').notNull(),
  version:integer('version').notNull(), latestEventId:text('latest_event_id').notNull(), updatedAt:text('updated_at').notNull(),
},table=>[primaryKey({columns:[table.kind,table.sourceId]}),index('signup_owner_idx').on(table.ownerUserId,table.kind)]);
export const signupEvents = sqliteTable('signup_events', {
  id:text('id').primaryKey(), kind:text('kind').notNull(), sourceId:text('source_id').notNull(),version:integer('version').notNull(),
  action:text('action').notNull(),actorUserId:text('actor_user_id').notNull(),publicNote:text('public_note').notNull(),
  detailsJson:text('details_json').notNull(),recordedAt:text('recorded_at').notNull(),
},table=>[uniqueIndex('signup_event_version_idx').on(table.kind,table.sourceId,table.version)]);

// Signed Paystack test delivery evidence; deliberately separate from live ledgers.
export const paystackTestDeliveries = sqliteTable('paystack_test_deliveries', {
 payloadHash:text('payload_hash').primaryKey(), eventType:text('event_type').notNull(),
 providerId:text('provider_id'), reference:text('reference'), providerStatus:text('provider_status'),
 metadataJson:text('metadata_json').notNull().default('{}'), amountMinor:integer('amount_minor'), currency:text('currency'), receivedAt:text('received_at').notNull(),
});

export const applicantVerificationChecks=sqliteTable('applicant_verification_checks',{
 id:text('id').primaryKey(),caseId:text('case_id').notNull(),ownerUserId:text('owner_user_id').notNull(),
 caseVersion:integer('case_version').notNull(),scenario:text('scenario').notNull(),signal:text('signal').notNull(),
 mode:text('mode').notNull().default('sandbox'),state:text('state').notNull(),attempts:integer('attempts').notNull().default(1),
 recoveryNote:text('recovery_note').notNull().default(''),recoveryActor:text('recovery_actor'),responseHash:text('response_hash'),httpStatus:integer('http_status'),retryAt:text('retry_at'),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('applicant_verification_request_idx').on(t.caseId,t.ownerUserId,t.caseVersion,t.scenario)]);

export const verificationRecoveryEvents=sqliteTable('verification_recovery_events',{
 id:text('id').primaryKey(),checkId:text('check_id').notNull(),snapshot:text('snapshot').notNull(),recordedAt:text('recorded_at').notNull(),
});
export const testEnrolmentOrders=sqliteTable('test_enrolment_orders',{
 reference:text('reference').primaryKey(),caseId:text('case_id').notNull(),ownerUserId:text('owner_user_id').notNull(),caseVersion:integer('case_version').notNull(),
 packageId:text('package_id').notNull(),packageVersion:text('package_version').notNull(),amountMinor:integer('amount_minor').notNull(),currency:text('currency').notNull(),
 state:text('state').notNull(),checkoutUrl:text('checkout_url'),providerId:text('provider_id'),revision:integer('revision').notNull().default(1),
 note:text('note').notNull().default(''),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('test_enrolment_case_package_idx').on(t.caseId,t.ownerUserId,t.caseVersion,t.packageId,t.packageVersion)]);
export const testEnrolmentEvents=sqliteTable('test_enrolment_events',{
 id:text('id').primaryKey(),reference:text('reference').notNull(),snapshot:text('snapshot').notNull(),recordedAt:text('recorded_at').notNull(),
});

export const testAgreementEnvelopes=sqliteTable('test_agreement_envelopes',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),caseId:text('case_id').notNull(),ownerUserId:text('owner_user_id').notNull(),caseVersion:integer('case_version').notNull(),
 documentVersion:text('document_version').notNull(),wording:text('wording').notNull(),contentHash:text('content_hash').notNull(),contextHash:text('context_hash').notNull(),
 state:text('state').notNull(),revision:integer('revision').notNull().default(1),issuedBy:text('issued_by').notNull(),issuedAt:text('issued_at').notNull(),expiresAt:text('expires_at').notNull(),
 signedBy:text('signed_by'),signerName:text('signer_name'),signedAt:text('signed_at'),reviewedBy:text('reviewed_by'),reviewedAt:text('reviewed_at'),note:text('note').notNull().default(''),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('test_agreement_case_version_idx').on(t.kind,t.caseId,t.caseVersion,t.documentVersion)]);
export const testAgreementEvents=sqliteTable('test_agreement_events',{
 id:text('id').primaryKey(),envelopeId:text('envelope_id').notNull(),snapshot:text('snapshot').notNull(),recordedAt:text('recorded_at').notNull(),
});
export const testOperatingCycles=sqliteTable('test_operating_cycles',{
 id:text('id').primaryKey(),clientCaseId:text('client_case_id').notNull(),officerCaseId:text('officer_case_id').notNull(),clientUserId:text('client_user_id').notNull(),officerUserId:text('officer_user_id').notNull(),
 clientVersion:integer('client_version').notNull(),officerVersion:integer('officer_version').notNull(),clientEnvelopeId:text('client_envelope_id').notNull(),officerEnvelopeId:text('officer_envelope_id').notNull(),
 siteBrief:text('site_brief').notNull(),amountMinor:integer('amount_minor').notNull(),officerAmountMinor:integer('officer_amount_minor').notNull(),state:text('state').notNull(),revision:integer('revision').notNull().default(1),
 createdBy:text('created_by').notNull(),lastActor:text('last_actor').notNull(),note:text('note').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});
export const testOperatingEvents=sqliteTable('test_operating_events',{
 id:text('id').primaryKey(),cycleId:text('cycle_id').notNull(),snapshot:text('snapshot').notNull(),recordedAt:text('recorded_at').notNull(),
});
export const publicOfficerPresence=sqliteTable('public_officer_presence',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),officerId:text('officer_id'),mode:text('mode').notNull(),latitude:real('latitude').notNull(),longitude:real('longitude').notNull(),consentedAt:text('consented_at').notNull(),updatedAt:text('updated_at').notNull(),expiresAt:text('expires_at').notNull(),
},t=>[uniqueIndex('public_presence_user_mode_idx').on(t.userId,t.mode)]);

export const productionEntityLinks=sqliteTable('production_entity_links',{
 kind:text('kind').notNull(),caseId:text('case_id').notNull(),caseVersion:integer('case_version').notNull(),ownerUserId:text('owner_user_id').notNull(),entityId:text('entity_id').notNull(),preparedBy:text('prepared_by').notNull(),preparedAt:text('prepared_at').notNull(),
},t=>[primaryKey({columns:[t.kind,t.caseId]}),uniqueIndex('production_entity_link_idx').on(t.kind,t.entityId)]);
export const signingDocumentBodies=sqliteTable('signing_document_bodies',{
 id:text('id').primaryKey(),documentCode:text('document_code').notNull(),documentVersion:text('document_version').notNull(),entityId:text('entity_id').notNull(),locale:text('locale').notNull(),wording:text('wording').notNull(),contentHash:text('content_hash').notNull(),preparedBy:text('prepared_by').notNull(),preparedAt:text('prepared_at').notNull(),
});
export const signingDocumentWithdrawals=sqliteTable('signing_document_withdrawals',{
 documentId:text('document_id').primaryKey(),withdrawnBy:text('withdrawn_by').notNull(),reason:text('reason').notNull(),withdrawnAt:text('withdrawn_at').notNull(),
});
export const productionSigningEnvelopes=sqliteTable('production_signing_envelopes',{
 id:text('id').primaryKey(),issuanceNumber:integer('issuance_number').notNull().default(1),documentId:text('document_id').notNull(),role:text('role').notNull(),ownerUserId:text('owner_user_id').notNull(),caseKind:text('case_kind').notNull(),caseId:text('case_id').notNull(),caseVersion:integer('case_version').notNull(),rosterSlotId:text('roster_slot_id').notNull(),officerId:text('officer_id').notNull(),slotVersion:integer('slot_version').notNull(),contextJson:text('context_json').notNull(),contextHash:text('context_hash').notNull(),contentHash:text('content_hash').notNull(),identityEvidence:text('identity_evidence').notNull(),authorityEvidence:text('authority_evidence'),issuedBy:text('issued_by').notNull(),issuedAt:text('issued_at').notNull(),expiresAt:text('expires_at').notNull(),
},t=>[index('production_envelope_owner_idx').on(t.ownerUserId,t.issuedAt),uniqueIndex('production_envelope_binding_idx').on(t.ownerUserId,t.documentId,t.contextHash,t.issuanceNumber)]);
export const productionEnvelopeCancellations=sqliteTable('production_envelope_cancellations',{
 envelopeId:text('envelope_id').primaryKey(),actorId:text('actor_id').notNull(),reason:text('reason').notNull(),cancelledAt:text('cancelled_at').notNull(),
});
export const productionActivationApprovals=sqliteTable('production_activation_approvals',{
 id:text('id').primaryKey(),requestJson:text('request_json').notNull(),requestHash:text('request_hash').notNull(),makerId:text('maker_id').notNull(),state:text('state').notNull(),approverId:text('approver_id'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});

export const productionClientReviews=sqliteTable('production_client_reviews',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),caseId:text('case_id').notNull(),caseVersion:integer('case_version').notNull(),ownerUserId:text('owner_user_id').notNull(),snapshotJson:text('snapshot_json').notNull(),snapshotHash:text('snapshot_hash').notNull(),evidenceJson:text('evidence_json').notNull(),preparedBy:text('prepared_by').notNull(),preparedAt:text('prepared_at').notNull(),expiresAt:text('expires_at').notNull(),
});
export const productionClientDecisions=sqliteTable('production_client_decisions',{
 reviewId:text('review_id').primaryKey().references(()=>productionClientReviews.id),decision:text('decision').notNull(),actorId:text('actor_id').notNull(),reason:text('reason').notNull(),decidedAt:text('decided_at').notNull(),
});
export const productionClientSuspensions=sqliteTable('production_client_suspensions',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),actorId:text('actor_id').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
});
export const productionOrderSetups=sqliteTable('production_order_setups',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),caseVersion:integer('case_version').notNull(),requestHash:text('request_hash').notNull(),requestJson:text('request_json').notNull(),quoteJson:text('quote_json').notNull(),preparedBy:text('prepared_by').notNull(),preparedAt:text('prepared_at').notNull(),
});
