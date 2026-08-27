import type {
  CoverageState,
  ExceptionPriority,
  IncidentSeverity,
  OperationalState,
} from "./operations-types";

const severityWeight: Record<IncidentSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const priorityWeight: Record<ExceptionPriority, number> = { P3: 1, P2: 2, P1: 3, P0: 4 };

export function ageInMinutes(timestamp: string | null, now: Date) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - value) / 60_000));
}

export function signalFreshness(ageMinutes: number): "fresh" | "stale" | "unavailable" {
  if (!Number.isFinite(ageMinutes)) return "unavailable";
  return ageMinutes <= 15 ? "fresh" : "stale";
}

export function minutesUntil(timestamp: string, now: Date) {
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.ceil((value - now.getTime()) / 60_000);
}

export function deriveCoverageState(input: {
  status: string;
  startsAt: string;
  arrivalDueAt: string;
  checkInDueAt: string;
  checkInAt: string | null;
  officerId: string | null;
  activeRelief: boolean;
  now: Date;
}): CoverageState {
  if (input.status === "completed") return "completed";
  if (input.status === "cancelled") return "cancelled";
  if (input.checkInAt || input.status === "on_post") return "on_post";
  if (input.activeRelief || input.status === "relief_active") return "relief_active";
  if (!input.officerId || input.status === "uncovered") return "uncovered";
  const minutesToArrivalDue = minutesUntil(input.arrivalDueAt, input.now);
  const minutesToCheckInDue = minutesUntil(input.checkInDueAt, input.now);
  if (minutesToCheckInDue < 0) return "check_in_missing";
  if (minutesToArrivalDue <= 0) return "arrival_at_risk";
  return "confirmed";
}

export function coverageStateLabel(state: CoverageState) {
  return ({
    confirmed: "Confirmed",
    arrival_at_risk: "Arrival at risk",
    check_in_missing: "Check-in not recorded",
    on_post: "On post",
    uncovered: "Unfilled post",
    relief_active: "Relief case open",
    completed: "Completed",
    cancelled: "Cancelled",
  } as const)[state];
}

export function highestSeverity(values: IncidentSeverity[]) {
  return values.sort((a, b) => severityWeight[b] - severityWeight[a])[0] ?? null;
}

export function highestPriority(values: ExceptionPriority[]) {
  return values.sort((a, b) => priorityWeight[b] - priorityWeight[a])[0] ?? null;
}

export function deriveOperationalState(input: {
  active: boolean;
  shiftStatus: string | null;
  signalAgeMinutes: number;
  highestIncidentSeverity: IncidentSeverity | null;
  highestExceptionPriority: ExceptionPriority | null;
  coverageState?: CoverageState | null;
}): OperationalState {
  if (!input.active) return "inactive";
  if (input.coverageState === "uncovered" || input.coverageState === "check_in_missing") return "critical";
  if (input.highestIncidentSeverity === "critical" || input.highestExceptionPriority === "P0") return "critical";
  if (
    input.highestIncidentSeverity === "high"
    || input.highestIncidentSeverity === "medium"
    || input.highestExceptionPriority === "P1"
    || input.highestExceptionPriority === "P2"
    || input.coverageState === "arrival_at_risk"
    || input.coverageState === "relief_active"
    || (input.shiftStatus === "on_post" && input.signalAgeMinutes > 15)
  ) return "attention";
  if (input.shiftStatus === "on_post") return "operational";
  if (input.shiftStatus === "confirmed" || input.shiftStatus === "staffed") return "scheduled";
  return "inactive";
}

export function operationalStateLabel(state: OperationalState) {
  return ({
    operational: "On post",
    scheduled: "Scheduled",
    attention: "Needs attention",
    critical: "Critical",
    inactive: "No active service",
  } as const)[state];
}

export function nextOperationalAction(input: {
  state: OperationalState;
  highestExceptionPriority: ExceptionPriority | null;
  openIncidentCount: number;
  shiftStatus: string | null;
  coverageState?: CoverageState | null;
}) {
  if (input.coverageState === "check_in_missing") return "Open relief case";
  if (input.coverageState === "uncovered") return "Secure coverage";
  if (input.coverageState === "arrival_at_risk") return "Prepare relief";
  if (input.coverageState === "relief_active") return "Monitor relief case";
  if (input.state === "critical") return "Escalate immediately";
  if (input.highestExceptionPriority === "P1") return "Secure coverage";
  if (input.openIncidentCount) return "Review incident";
  if (input.state === "attention") return "Validate latest signal";
  if (input.shiftStatus === "confirmed") return "Monitor arrival";
  if (input.state === "operational") return "Monitor handover";
  return "Review service plan";
}

export function projectGautengCoordinate(latitude: number, longitude: number) {
  const bounds = { north: -25.86, south: -26.24, west: 27.82, east: 28.28 };
  const clamp = (value: number) => Math.min(96, Math.max(4, value));
  return {
    x: clamp(((longitude - bounds.west) / (bounds.east - bounds.west)) * 100),
    y: clamp(((bounds.north - latitude) / (bounds.north - bounds.south)) * 100),
  };
}
