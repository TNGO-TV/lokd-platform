import type { SpecialistServiceCode } from "./specialist-pricing";

export type SpecialistEnvironment = "demo" | "production";
export type SpecialistEvidence = { code: string; reference: string; validFrom: string; expiresAt: string };
export type SpecialistPackContent = {
  commandOwner: string;
  clientBrief: string;
  officerBrief: string;
  officerIds: string[];
  partnerId: string;
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
export type SpecialistPartner = {
  id: string; name: string; serviceCodes: SpecialistServiceCode[];
  evidenceReference: string; validFrom: string; expiresAt: string;
  status: string; version: number; preparedBy: string; approvedBy: string | null;
};
export type SpecialistCommercialReview = {
  id: string; status: string; version: number; evidenceReference: string;
  expiresAt: string; preparedBy: string; approvedBy: string | null;
};
export type SpecialistScenarioResult = {
  serviceCode: SpecialistServiceCode; label: string; status: "passed" | "failed";
  totalCents: number; steps: { label: string; passed: boolean; detail: string }[];
};
export type SpecialistOperationsState = {
  environment: SpecialistEnvironment;
  actorEmail: string;
  bookings: SpecialistBooking[]; packs: SpecialistPack[]; partners: SpecialistPartner[];
  officers: { id: string; name: string }[];
  commercialReview: SpecialistCommercialReview | null;
  rehearsals: { id: string; createdAt: string; runBy: string; scenarios: SpecialistScenarioResult[] }[];
  productionBlockers: string[];
};
export type SpecialistAction =
  | { action: "save_pack"; bookingId: string; version: number; content: SpecialistPackContent }
  | { action: "submit_pack" | "approve_pack" | "revoke_pack"; id: string; version: number }
  | { action: "submit_commercial"; evidenceReference: string; expiresAt: string; version: number }
  | { action: "approve_commercial" | "revoke_commercial"; id: string; version: number }
  | { action: "add_partner"; name: string; serviceCodes: SpecialistServiceCode[]; evidenceReference: string; validFrom: string; expiresAt: string }
  | { action: "approve_partner" | "revoke_partner"; id: string; version: number }
  | { action: "run_rehearsals" };
