import type {PolicyWarning} from './workforce-policy-warnings';
import type {OfficerEmployment} from './officer-employment';
import type { ZoneMapPoint } from './zone-location';
export type DispatchSlot = { pay_basis?: string | null; id: string; booking_id: string; client_price_cents: number; version: number; status: string; starts_at: string; ends_at: string; site_name: string; site_area: string; minimum_grade: string; assignment_id: string | null; assignment_version: number | null; officer_id: string | null; latitude: number; longitude: number; engagement_model: string };
export type DispatchCandidate = { payBasis?: string | null; employment?: OfficerEmployment | null; id: string; full_name: string; city: string; psira_grade: string; starts_at: string; ends_at: string };
export type DispatchRequest = { id: string; summary: string; siteName: string; siteArea: string; requestedAt: string; startsAt: string | null; status: string; source: 'zone' | 'public'; engagementModel: string; priority: string };
export type ZoneContract = { id: string; siteName: string; siteArea: string; startDate: string; endDate: string; term: number; rosterPattern: string; headcount: number; status: string; upcoming: number; gaps: number };
export type ZoneOperationsState = { policyWarnings?:PolicyWarning[]; employmentReviews?: ({id:string;fullName:string;engagementId:string;version:number;agreedHourlyRateCents:number|null;payCadence:string;payCadenceRequestReference:string|null;employment:OfficerEmployment|null})[]; rosters: DispatchSlot[]; rosterCandidates: DispatchCandidate[]; requests: DispatchRequest[]; contracts: ZoneContract[]; points: ZoneMapPoint[]; approvals: { id: string; state: string; maker_id: string }[]; checkedAt: string };
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: Record<string, unknown>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
export function zoneOperationsResponse(value: unknown): value is { state: ZoneOperationsState; result?: { message?:string;ready?: boolean; blockers?: { code: string; detail: string }[]; requiresIndependentApproval?: boolean } } {
  if (!rec(value) || !rec(value.state)) return false;
  const s = value.state;
  return typeof s.checkedAt === 'string' && Number.isFinite(Date.parse(s.checkedAt))
    && Array.isArray(s.rosters) && s.rosters.every(r => rec(r) && strings(r, ['id', 'booking_id', 'status', 'starts_at', 'ends_at', 'site_name', 'site_area', 'minimum_grade', 'engagement_model']) && Number.isSafeInteger(r.version) && Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    && Array.isArray(s.rosterCandidates) && s.rosterCandidates.every(r => rec(r) && strings(r, ['id', 'full_name', 'city', 'psira_grade', 'starts_at', 'ends_at']))
    && Array.isArray(s.requests) && s.requests.every(r => rec(r) && strings(r, ['id', 'summary', 'siteName', 'siteArea', 'requestedAt', 'status', 'source', 'engagementModel', 'priority']) && (r.startsAt === null || typeof r.startsAt === 'string'))
    && Array.isArray(s.contracts) && s.contracts.every(r => rec(r) && strings(r, ['id', 'siteName', 'siteArea', 'startDate', 'endDate', 'rosterPattern', 'status']) && ['term', 'headcount', 'upcoming', 'gaps'].every(k => Number.isSafeInteger(r[k])))
    && Array.isArray(s.points) && s.points.every(p => rec(p) && strings(p, ['id', 'name', 'capturedAt', 'mode']) && ['latitude', 'longitude', 'accuracy'].every(k => Number.isFinite(p[k])))
    && Array.isArray(s.approvals) && s.approvals.every(a => rec(a) && strings(a, ['id', 'state', 'maker_id']));
}
