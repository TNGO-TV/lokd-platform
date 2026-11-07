import type { SpecialistServiceCode } from "./specialist-pricing";

export type SpecialistEnvironment = "production";
export type SpecialistEvidence = { code: string; reference: string; validFrom: string; expiresAt: string };
export type SpecialistPackContent = {
  commandOwner: string;
  clientBrief: string;
  officerBrief: string;
  officerIds: string[];
  checks: SpecialistEvidence[];
};
export type SpecialistBooking = {
  id: string; clientId: string; siteName: string; serviceCode: SpecialistServiceCode;
  configuration: string; pricingVersion: string; subtotalCents: number; vatCents: number;
  totalCents: number; costFloorCents: number; marginBasisPoints: number;
  headcount: number; startsAt: string | null; endsAt: string | null;
  pricingStatus: string; pricingValid: number; planCurrent: number; authorityCurrent: number; fundingCurrent: number;
  environment: SpecialistEnvironment;
};
export type SpecialistPack = {
  id: string; bookingId: string; status: string; version: number;
  content: SpecialistPackContent; quoteSnapshot: string;
  preparedBy: string; approvedBy: string | null; approvedAt: string | null;
  updatedAt: string; blockers: string[];
};
export type SpecialistCommercialReview = {
  id: string; status: string; version: number; evidenceReference: string;
  expiresAt: string; preparedBy: string; approvedBy: string | null;
};
export type SpecialistOperationsState = {
  environment: SpecialistEnvironment;
  actorEmail: string;
  bookings: SpecialistBooking[]; packs: SpecialistPack[];
  officers: { id: string; name: string }[];
  commercialReview: SpecialistCommercialReview | null;
};
export type SpecialistAction =
  | { action: "save_pack"; bookingId: string; version: number; content: SpecialistPackContent }
  | { action: "submit_pack" | "approve_pack" | "revoke_pack"; id: string; version: number }
  | { action: "submit_commercial"; evidenceReference: string; expiresAt: string; version: number }
  | { action: "approve_commercial" | "revoke_commercial"; id: string; version: number };
