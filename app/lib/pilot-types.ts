export type ServiceType = "Unarmed" | "Armed" | "VIP";
export type OfferStatus = "open" | "accepted" | "declined" | "expired";
export type LedgerState = "pending_signoff" | "pending_release" | "available" | "withdrawal_queued" | "paid" | "held";
export type PassportStatus = "active" | "expiring" | "restricted" | "training" | "remediation" | "suspended" | "revoked";

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
  minimumGrade: string;
  contractMonths: number;
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

export type PilotBooking = {
  id: string;
  siteName: string;
  siteArea: string;
  postName: string;
  serviceType: ServiceType;
  purposeCode: string;
  purposeLabel: string;
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
  wallet: {
    pendingCents: number;
    availableCents: number;
    withdrawalQueuedCents: number;
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
      serviceType: ServiceType;
      term: "single" | "1" | "3" | "6" | "12";
      noticeWindow: "standard" | "priority" | "urgent" | "immediate";
      purposeCode: string;
      startDate: string;
      shift: "day" | "night";
      postName: string;
      instructions: string;
    }
  | { action: "confirm_booking_payment"; bookingId: string }
  | { action: "release_offer_wave"; bookingId: string }
  | { action: "reset_demo" }
  | { action: "accept_offer"; offerId: string }
  | { action: "decline_offer"; offerId: string }
  | { action: "update_service_preference"; serviceType: ServiceType; optedIn: boolean }
  | { action: "check_in"; shiftId: string }
  | { action: "complete_shift"; shiftId: string }
  | { action: "report_issue"; shiftId: string; category: string }
  | { action: "client_signoff"; shiftId: string }
  | { action: "release_earnings" }
  | { action: "request_payout" };
