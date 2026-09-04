import type {
  SpecialistConfiguration,
  SpecialistServiceCode,
} from "./specialist-pricing";

export type ServiceType = "Unarmed" | "Armed" | "VIP";
export type EngagementModel = "fixed" | "flex";
export type RosterPattern = "weekdays" | "monday_saturday" | "daily";
export type CalendarCategory =
  "ordinary" | "sunday" | "public_holiday" | "easter" | "christmas";
export type RiskBand =
  "Standard" | "Enhanced" | "Elevated" | "High" | "Critical";
export type OfferStatus = "open" | "accepted" | "declined" | "expired";
export type LedgerState =
  | "pending_signoff"
  | "pending_release"
  | "available"
  | "withdrawal_queued"
  | "paid"
  | "held";
export type PassportStatus =
  | "active"
  | "expiring"
  | "restricted"
  | "training"
  | "remediation"
  | "suspended"
  | "revoked";
export type PilotScope = "operations" | "client" | "officer";

export type PassportEndorsement = {
  id: string;
  code: string;
  label: string;
  category: "core" | "service" | "purpose" | "skill";
  serviceType: ServiceType | null;
  purposeCode: string | null;
  status: string;
  assessedAt: string | null;
  expiresAt: string | null;
  nextDueAt: string | null;
};

export type PilotPassport = {
  passportNumber: string;
  verificationPath: string;
  status: PassportStatus;
  readinessLabel: string;
  issuedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  offersEnabled: boolean;
  gateMessage: string;
  endorsements: PassportEndorsement[];
};

export type PilotOffer = {
  id: string;
  bookingId: string;
  siteName: string;
  siteArea: string;
  postName: string;
  serviceType: ServiceType;
  purposeCode: string;
  purposeLabel: string;
  engagementModel: EngagementModel;
  rosterPattern: RosterPattern;
  calendarCategory: CalendarCategory;
  calendarLabel: string;
  riskBand: RiskBand;
  riskScore: number;
  requiredEndorsements: string[];
  shiftCount: number;
  plannedEarningsCents: number;
  positionIndex: number;
  minimumGrade: string;
  contractMonths: number;
  startDate: string;
  shiftStart: string;
  shiftEnd: string;
  amountCents: number;
  releaseCadence: "Weekly" | "Monthly";
  fundingStatus: string;
  status: OfferStatus;
  expiresAt: string;
};

export type PilotShift = {
  id: string;
  bookingId: string;
  siteName: string;
  postName: string;
  serviceType: ServiceType;
  purposeCode: string;
  purposeLabel: string;
  scheduledDate: string;
  shiftStart: string;
  shiftEnd: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  passportVerificationStatus: string;
  passportVerifiedAt: string | null;
  clientSignoffStatus: string;
  earningsCents: number;
  releaseCadence: "Weekly" | "Monthly";
};

export type PilotLedgerEntry = {
  id: string;
  shiftId: string;
  bookingId: string;
  siteName: string;
  amountCents: number;
  state: LedgerState;
  releaseCadence: "Weekly" | "Monthly";
  eligibleReleaseAt: string | null;
  updatedAt: string;
};

export type PilotPayrollLine = {
  id: string;
  lineType: "earning" | "deduction" | "employer_cost" | "accrual";
  code: string;
  description: string;
  amountCents: number;
  quantityMinutes: number | null;
  rateCents: number | null;
  ruleVersion: string;
};

export type PilotPayrollStatement = {
  id: string;
  payrollRunId: string;
  officerName: string;
  siteName: string;
  shiftCount: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  runStatus: string;
  grossCents: number;
  employeeDeductionCents: number;
  netPayCents: number;
  employerCostCents: number;
  policyVersion: string;
  calculationVersion: string;
  generatedAt: string;
  paidAt: string | null;
  lines: PilotPayrollLine[];
};

export type PilotBooking = {
  id: string;
  siteName: string;
  siteArea: string;
  postName: string;
  serviceType: ServiceType;
  purposeCode: string;
  purposeLabel: string;
  engagementModel: EngagementModel;
  noticeWindow: "standard" | "priority" | "urgent" | "immediate";
  rosterPattern: RosterPattern;
  calendarCategory: CalendarCategory;
  calendarLabel: string;
  riskBand: RiskBand;
  riskScore: number;
  riskReasons: string[];
  requiredEndorsements: string[];
  manualReview: boolean;
  headcount: number;
  serviceDayCount: number;
  shiftCount: number;
  officerTotalCents: number;
  grossPlatformContributionCents: number;
  pricingVersion: string;
  pricingBreakdown: {
    baseClientCents: number;
    calendarPremiumCents: number;
    dispatchPremiumCents: number;
    riskPremiumCents: number;
    marginFloorAdjustmentCents: number;
    subtotalCents: number;
    vatCents: number;
    payrollBurdenCents: number;
    readinessAndEquipmentCents: number;
    commandAndSupervisionCents: number;
    planningCents: number;
    travelCents: number;
    vehicleAndPartnerCents: number;
    overnightCents: number;
  };
  specialistServiceCode: SpecialistServiceCode;
  specialistConfiguration: SpecialistConfiguration;
  subtotalCents: number;
  vatCents: number;
  vatRateBasisPoints: number;
  pricingStatus: "authoritative" | "partner_review_required";
  pricingInternal?: {
    costFloorCents: number;
    marginCents: number;
    marginBasisPoints: number;
    minimumMarginBasisPoints: number;
    payrollBurdenCents: number;
    readinessAndEquipmentCents: number;
    commandAndSupervisionCents: number;
    planningCents: number;
    travelCents: number;
    vehicleAndPartnerCents: number;
    overnightCents: number;
  };
  minimumGrade: string;
  contractMonths: number;
  startDate: string;
  endDate: string;
  shiftStart: string;
  shiftEnd: string;
  clientPriceCents: number;
  officerRateCents: number;
  fundingStatus: string;
  releaseCadence: "Weekly" | "Monthly";
  status: string;
  offerStatus: OfferStatus | null;
  assignedOfficer: string | null;
  matchEligible: boolean;
  matchBlockers: string[];
};

export type PilotState = {
  officer: {
    id: string;
    fullName: string;
    initials: string;
    city: string;
    psiraNumber: string;
    psiraGrade: string;
    psiraExpiry: string;
    approvalStatus: string;
    bankingStatus: string;
    flexAvailable: boolean;
    externalWorkAcknowledged: boolean;
    restWindowConfirmed: boolean;
    services: Array<{
      serviceType: ServiceType;
      qualified: boolean;
      optedIn: boolean;
      qualificationExpiry: string | null;
    }>;
    compliance: Array<{
      id: string;
      recordType: string;
      status: string;
      expiresAt: string | null;
      nextDueAt: string | null;
    }>;
    passport: PilotPassport;
  };
  client: {
    id: string;
    organisationName: string;
    contactName: string;
    approvalStatus: string;
  };
  offers: PilotOffer[];
  bookings: PilotBooking[];
  shifts: PilotShift[];
  ledger: PilotLedgerEntry[];
  payrollStatements: PilotPayrollStatement[];
  wallet: {
    pendingCents: number;
    availableCents: number;
    withdrawalQueuedCents: number;
    calculatedNetCents: number;
    paidCents: number;
    totalTrackedCents: number;
  };
  audit: Array<{
    id: string;
    actorType: string;
    eventType: string;
    entityType: string;
    entityId: string;
    detail: string;
    createdAt: string;
  }>;
};

export type PilotAction =
  | {
      action: "create_booking";
      commandId: string;
      siteName: string;
      siteArea: string;
      addressLabel: string;
      serviceType: ServiceType;
      engagementModel: EngagementModel;
      term: "single" | "1" | "3" | "6" | "12";
      rosterPattern: RosterPattern;
      purposeCode: string;
      riskInput: {
        assetExposure: "standard" | "valuable" | "high_value";
        publicAccess: "controlled" | "moderate" | "open";
        incidentHistory: "none" | "isolated" | "repeated";
        existingControls: "strong" | "partial" | "limited";
        nightOperation: boolean;
        vulnerablePeople: boolean;
      };
      specialistConfiguration: SpecialistConfiguration;
      startDate: string;
      shift: "day" | "night";
      postName: string;
      instructions: string;
    }
  | { action: "confirm_booking_payment"; bookingId: string }
  | {
      action: "create_client_service_request";
      category: string;
      summary: string;
      detail: string;
      bookingId?: string;
      shiftId?: string;
    }
  | {
      action: "create_officer_service_request";
      category: string;
      summary: string;
      detail: string;
      shiftId?: string;
    }
  | { action: "approve_risk_plan"; bookingId: string }
  | { action: "release_offer_wave"; bookingId: string }
  | { action: "reset_demo" }
  | { action: "accept_offer"; offerId: string }
  | { action: "decline_offer"; offerId: string }
  | {
      action: "update_service_preference";
      serviceType: ServiceType;
      optedIn: boolean;
    }
  | {
      action: "update_flex_availability";
      available: boolean;
      externalWorkAcknowledged: boolean;
      restWindowConfirmed: boolean;
    }
  | { action: "record_demo_arrival_check"; shiftId: string }
  | { action: "check_in"; shiftId: string }
  | { action: "complete_shift"; shiftId: string }
  | { action: "report_issue"; shiftId: string; category: string }
  | { action: "client_signoff"; shiftId: string }
  | { action: "release_earnings" }
  | { action: "request_payout" };
