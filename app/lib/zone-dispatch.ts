import type { DispatchSlot, DispatchCandidate, DispatchRequest, ZoneOperationsState } from './zone-operations-types';
import { distanceMetres } from './zone-map';
export function rankDispatchRequests(requests: DispatchRequest[]) {
  return [...requests].sort((a, b) => (a.startsAt ? Date.parse(a.startsAt) : Infinity) - (b.startsAt ? Date.parse(b.startsAt) : Infinity) || a.requestedAt.localeCompare(b.requestedAt));
}
export function dispatchCandidates(slot: DispatchSlot, candidates: DispatchCandidate[], points: ZoneOperationsState['points']) {
  const grade = (s: string) => { const index = 'ABCDE'.indexOf(s.replace(/^Grade\s+/i, '').trim().toUpperCase()); return index < 0 ? 99 : index; };
  const locations = new Map(points.map(p => [p.id, p]));
  return [...new Map(candidates.filter(c => grade(slot.minimum_grade) !== 99 && grade(c.psira_grade) <= grade(slot.minimum_grade) && c.starts_at <= slot.starts_at && c.ends_at >= slot.ends_at).map(c => [c.id, c])).values()].map(c => ({ ...c, distance: locations.has(c.id) ? distanceMetres(slot, locations.get(c.id)!) : null })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.full_name.localeCompare(b.full_name));
}
