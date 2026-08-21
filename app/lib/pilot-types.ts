export type ServiceType = "Unarmed" | "Armed" | "VIP";
export type OfferStatus = "open" | "accepted" | "declined" | "expired";
export type LedgerState = "pending_signoff" | "pending_release" | "available" | "withdrawal_queued" | "paid" | "held";

export type PilotOffer = {
  id: string;
  bookingId: string;
  siteName: string;
  siteArea: string;
  postName: string;
  serviceType: ServiceType;
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
  scheduledDate: string;
  shiftStart: string;
  shiftEnd: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
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
  };
  client: {
    id: string;
    organisationName: string;
    contactName: string;
    approvalStatus: string;
  };
  offers: PilotOffer[];
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
  | { action: "accept_offer"; offerId: string }
  | { action: "decline_offer"; offerId: string }
  | { action: "update_service_preference"; serviceType: ServiceType; optedIn: boolean }
  | { action: "check_in"; shiftId: string }
  | { action: "complete_shift"; shiftId: string }
  | { action: "report_issue"; shiftId: string; category: string }
  | { action: "client_signoff"; shiftId: string }
  | { action: "release_earnings" }
  | { action: "request_payout" };
