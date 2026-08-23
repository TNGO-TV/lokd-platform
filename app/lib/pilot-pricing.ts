import type { ServiceType } from "./pilot-types";

export type ContractTerm = "single" | "1" | "3" | "6" | "12";
export type NoticeWindow = "standard" | "priority" | "urgent" | "immediate";

export const PRICE_BOOK_VERSION = "LOKD-PREMIUM-2026.08";

export const servicePriceBook: Record<ServiceType, {
  clientShiftCents: number;
  officerShiftCents: number;
  minimumGrade: string;
  label: string;
  note: string;
}> = {
  Unarmed: {
    clientShiftCents: 240_000,
    officerShiftCents: 110_000,
    minimumGrade: "Grade C",
    label: "Purpose-trained protection",
    note: "LOKD assessed professional for access, patrol and site-specific duties.",
  },
  Armed: {
    clientShiftCents: 420_000,
    officerShiftCents: 200_000,
    minimumGrade: "Grade B",
    label: "Armed readiness",
    note: "Continuously assessed armed professional with current monthly readiness.",
  },
  VIP: {
    clientShiftCents: 850_000,
    officerShiftCents: 450_000,
    minimumGrade: "Grade B",
    label: "Protective Operations",
    note: "Specialist protective operator with advanced selection and recurring tactical assessment.",
  },
};

export const noticePriceBook: Record<NoticeWindow, {
  label: string;
  clientMultiplier: number;
  officerMultiplier: number;
}> = {
  standard: { label: "72+ hours · standard", clientMultiplier: 1, officerMultiplier: 1 },
  priority: { label: "24–72 hours · +15%", clientMultiplier: 1.15, officerMultiplier: 1.08 },
  urgent: { label: "6–24 hours · +25%", clientMultiplier: 1.25, officerMultiplier: 1.15 },
  immediate: { label: "Under 6 hours · +40%", clientMultiplier: 1.4, officerMultiplier: 1.25 },
};

export const purposePriceBook = [
  { code: "commercial_access", label: "Commercial access" },
  { code: "construction", label: "Construction site" },
  { code: "school", label: "School" },
  { code: "retail", label: "Retail" },
  { code: "residential", label: "Residential" },
  { code: "event", label: "Event" },
  { code: "logistics_industrial", label: "Logistics / industrial" },
  { code: "secure_logistics", label: "Secure logistics" },
  { code: "executive_protection", label: "Executive protection" },
] as const;

export const termLabels: Record<ContractTerm, string> = {
  single: "Single shift",
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

export function cadenceForTerm(term: ContractTerm): "Weekly" | "Monthly" {
  return term === "single" || Number(term) <= 3 ? "Weekly" : "Monthly";
}

export function quoteBooking(serviceType: ServiceType, term: ContractTerm, noticeWindow: NoticeWindow) {
  const service = servicePriceBook[serviceType];
  const notice = noticePriceBook[noticeWindow];
  const shiftCount = term === "single" ? 1 : Number(term) * 20;
  return {
    version: PRICE_BOOK_VERSION,
    shiftCount,
    contractMonths: term === "single" ? 0 : Number(term),
    clientPriceCents: Math.round(service.clientShiftCents * shiftCount * notice.clientMultiplier),
    officerRateCents: Math.round(service.officerShiftCents * notice.officerMultiplier),
    clientShiftCents: Math.round(service.clientShiftCents * notice.clientMultiplier),
    minimumGrade: service.minimumGrade,
    releaseCadence: cadenceForTerm(term),
    serviceLabel: service.label,
    noticeLabel: notice.label,
  };
}

export function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateValue;
  if (months <= 0) return dateValue;
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
