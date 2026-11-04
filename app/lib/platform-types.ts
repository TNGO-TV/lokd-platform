import type { ServiceType } from "./production-service-types";

export type { ServiceType };
export type PassportStatus =
  | "active"
  | "expiring"
  | "restricted"
  | "training"
  | "remediation"
  | "suspended"
  | "revoked";

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
