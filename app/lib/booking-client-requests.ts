import { SignupError } from './signup-server';
import type { SigningActor } from './production-signing';
import { clientNotificationStatement } from './quote-notifications';
import type { ClientRequest } from './booking-client-types';

export type OperationsClientRequest = ClientRequest & {
  clientId: string | null;
  clientOwnerUserId: string;
  organisationName: string;
  contactName: string;
  email: string;
  mobile: string | null;
  siteName: string;
  siteArea: string;
  address: string;
  ownerId: string | null;
  priority: string;
  publicNote: string | null;
  updatedAt: string;
};
export type OperationsClientRequests = { serviceRequests: OperationsClientRequest[]; viewerUserId: string; isOwner: boolean };
const categories = "'client_site','booking_request','booking_change','booking_cancellation','shift_rating','service_issue'";
function operations(actor: SigningActor) { if (!actor.operations) throw new SignupError('Operations access required.', 403); }
function field(value: unknown, label: string, max = 200) {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > max) throw new SignupError(`Enter ${label}.`);
  return value.trim();
}
function details(value: string): Record<string, unknown> {
  try { const parsed: unknown = JSON.parse(value); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* Older requests may contain plain notes. */ }
  return { note: value };
}

export async function readOperationsClientRequests(db: D1Database, actor: SigningActor): Promise<OperationsClientRequests> {
  operations(actor);
  const rows = await db.prepare(`SELECT r.id,r.category,r.status,r.summary,r.detail,r.version,r.created_at AS createdAt,
    r.updated_at AS updatedAt,r.booking_id AS bookingId,r.shift_id AS shiftId,COALESCE(r.client_id,c.id) AS clientId,
    r.requested_by_id AS clientOwnerUserId,r.owner_id AS ownerId,r.priority,
    COALESCE(json_extract(sc.corrections_json,'$.organisationName'),e.organisation_name,c.organisation_name,'') AS organisationName,
    COALESCE(json_extract(sc.corrections_json,'$.contactName'),e.contact_name,c.contact_name,'') AS contactName,
    COALESCE(e.email_normalized,c.contact_email,'') AS email,
    COALESCE(json_extract(sc.corrections_json,'$.mobile'),e.mobile_normalized) AS mobile,
    COALESCE(json_extract(r.detail,'$.siteName'),CASE WHEN r.category='client_site' THEN json_extract(r.detail,'$.name') END,b.site_name,'') AS siteName,
    COALESCE(json_extract(r.detail,'$.siteArea'),json_extract(r.detail,'$.area'),b.site_area,e.site_area,'') AS siteArea,
    COALESCE(json_extract(r.detail,'$.address'),s.address_label,'') AS address,
    json_extract(r.detail,'$.publicNote') AS publicNote
    FROM service_requests r
    LEFT JOIN clients c ON c.id=COALESCE(r.client_id,(SELECT l.entity_id FROM production_entity_links l WHERE l.kind='client' AND l.owner_user_id=r.requested_by_id ORDER BY l.prepared_at DESC LIMIT 1))
    LEFT JOIN signup_cases sc ON sc.kind='client' AND sc.source_id=(SELECT k.source_id FROM signup_cases k WHERE k.kind='client' AND k.owner_user_id=r.requested_by_id ORDER BY k.updated_at DESC LIMIT 1)
    LEFT JOIN client_enquiries e ON e.id=sc.source_id
    LEFT JOIN bookings b ON b.id=r.booking_id AND b.environment='production'
    LEFT JOIN operational_sites s ON s.id=(SELECT z.id FROM operational_sites z WHERE z.booking_id=b.id AND z.environment='production' ORDER BY z.created_at DESC LIMIT 1)
    WHERE r.environment='production' AND r.integrity_state='production_verified' AND r.requested_by_role='client' AND r.category IN (${categories})
    ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'triaged' THEN 1 ELSE 2 END,CASE r.priority WHEN 'high' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200`).all<Omit<OperationsClientRequest, 'detail'> & { detail: string }>();
  return { serviceRequests: rows.results.map(row => ({ ...row, detail: details(row.detail) })), viewerUserId: actor.userId, isOwner: actor.owner };
}

export async function reviewClientRequest(db: D1Database, actor: SigningActor, input: Record<string, unknown>) {
  operations(actor);
  if (input.action !== 'review_request' || !['triaged', 'closed'].includes(String(input.status))) throw new SignupError('Choose to triage or close this request.');
  const id = field(input.id, 'the request reference'), note = field(input.note, 'a message for the client', 2000);
  const row = await db.prepare(`SELECT id,requested_by_id,owner_id,status,version,detail,summary FROM service_requests
    WHERE id=? AND environment='production' AND integrity_state='production_verified' AND requested_by_role='client' AND category IN (${categories})`).bind(id).first<{ id: string; requested_by_id: string; owner_id: string | null; status: string; version: number; detail: string; summary: string }>();
  if (!row) throw new SignupError('Service request not found.', 404);
  if (row.requested_by_id === actor.userId) throw new SignupError('Another operator must review your own request.', 403);
  if (row.owner_id && row.owner_id !== actor.userId && !actor.owner) throw new SignupError('This request belongs to another operator.', 403);
  if (input.expectedVersion !== row.version || !['open', 'triaged'].includes(row.status) || input.status === 'triaged' && row.status !== 'open') throw new SignupError('This request changed. Refresh before reviewing it.', 409);
  const now = new Date().toISOString(), nextVersion = row.version + 1, status = input.status as 'triaged' | 'closed';
  const updated = { ...details(row.detail), publicNote: note, noteRecordedAt: now };
  const notificationIds = [`request-review:client:${id}:${nextVersion}`, `request-review:operations:${id}:${nextVersion}`];
  const message = `${row.summary}\n\n${note}\n\nStatus: ${status === 'triaged' ? 'Under review' : 'Closed'}\nReference: ${id}\n\nView your requests: https://portal.lokd.co.za/client\n\nLOKD Security`;
  await db.batch([
    db.prepare(`INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,'operations',?,'client_service_request_reviewed','service_request',?,?,?)`).bind(crypto.randomUUID(), actor.userId, id, JSON.stringify({ expectedVersion: row.version, status, note, ownerOverride: actor.owner }), now),
    db.prepare(`UPDATE service_requests SET status=?,owner_id=?,detail=?,version=version+1,updated_at=?,resolved_at=CASE WHEN ?='closed' THEN ? ELSE NULL END WHERE id=? AND version=?`).bind(status, actor.userId, JSON.stringify(updated), now, status, now, id, row.version),
    ...notificationIds.map((notificationId, index) => clientNotificationStatement(db, { id: notificationId, sourceId: id, ownerUserId: row.requested_by_id, recipient: index ? 'operations' : 'client', subject: 'LOKD | An update on your request', text: message, createdAt: now })),
  ]);
  return { id, status, version: nextVersion, notificationIds };
}
