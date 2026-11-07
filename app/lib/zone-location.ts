import { SignupError } from './signup-server';
import type { SigningActor } from './production-signing';

export type LocationConsent = { revision: number; sessionId: string; active: boolean; mode: 'dispatch' | 'en_route'; shiftId: string | null; expiresAt: string };
export type ZoneMapPoint = { id: string; name: string; latitude: number; longitude: number; accuracy: number; capturedAt: string; mode: 'dispatch' | 'en_route' };
const live = `FROM officer_dispatch_locations p JOIN officer_dispatch_consents c ON c.owner_user_id=p.owner_user_id AND c.session_id=p.session_id AND c.revision=p.revision JOIN officers o ON o.id=c.officer_id WHERE c.active=1 AND o.approval_status='approved' AND julianday(p.expires_at)>julianday('now') AND julianday(c.expires_at)>julianday('now') AND julianday(p.captured_at)>=julianday('now','-2 minutes') AND EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=o.id AND json_extract(a.source_json,'$.owner_user_id')=c.owner_user_id AND julianday(a.expires_at)>julianday('now')) AND (c.mode='dispatch' OR EXISTS(SELECT 1 FROM shifts s JOIN roster_assignments r ON r.shift_id=s.id AND r.status='confirmed' AND r.active_key=r.roster_slot_id WHERE s.id=c.shift_id AND s.officer_id=c.officer_id AND s.status='confirmed'))`;
const projection = `SELECT o.id,o.full_name AS name,p.latitude,p.longitude,p.accuracy_meters AS accuracy,p.captured_at AS capturedAt,c.mode `;
export async function ownLocationConsent(db: D1Database, actor: SigningActor): Promise<LocationConsent | null> {
  const row = await db.prepare('SELECT revision,session_id AS sessionId,active,mode,shift_id AS shiftId,expires_at AS expiresAt FROM officer_dispatch_consents WHERE owner_user_id=?').bind(actor.userId).first<Omit<LocationConsent, 'active'> & { active: number }>();
  return row ? { ...row, active: row.active === 1 && Date.parse(row.expiresAt) > Date.now() } : null;
}
export function validateSharedLocation(input: Record<string, unknown>, now = Date.now()) {
  const { latitude, longitude, accuracy, capturedAt } = input;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -35 || latitude > -22 || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < 16 || longitude > 33 || typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 150) throw new SignupError('Capture a precise South African location within 150 metres.');
  const stamp = typeof capturedAt === 'string' ? Date.parse(capturedAt) : NaN;
  if (!Number.isFinite(stamp) || stamp < now - 120000 || stamp > now + 10000) throw new SignupError('Capture a fresh location before sharing.');
  return { latitude, longitude, accuracy, capturedAt: new Date(stamp).toISOString() };
}
export async function operateZoneLocation(db: D1Database, actor: SigningActor, input: Record<string, unknown>) {
  if (actor.operations) throw new SignupError('Share location from your Officer Zone.', 403);
  if (input.action === 'stop_sharing') {
    // Always wins over an in-flight point from the old session. It can also stop
    // sharing after an approval expires, when no new point is permitted.
    await db.prepare('UPDATE officer_dispatch_consents SET active=0,revision=revision+1,updated_at=? WHERE owner_user_id=?').bind(new Date().toISOString(), actor.userId).run();
    return { message: 'Location sharing stopped.' };
  }
  if (input.action === 'start_sharing') {
    if (input.locationConsent !== true || !['dispatch', 'en_route'].includes(String(input.mode)) || !Number.isSafeInteger(input.expectedRevision)) throw new SignupError('Choose and explicitly allow location sharing.');
    const officer = await db.prepare(`SELECT o.id FROM officers o JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=o.id JOIN current_production_officer_approvals a ON a.officer_id=o.id AND json_extract(a.source_json,'$.owner_user_id')=l.owner_user_id WHERE l.owner_user_id=? AND o.approval_status='approved' AND julianday(a.expires_at)>julianday('now')`).bind(actor.userId).all<{ id: string }>();
    if (officer.results.length !== 1) throw new SignupError('Current officer verification is required to share location.', 409);
    const revision = Number(input.expectedRevision) + 1, sessionId = crypto.randomUUID(), now = new Date().toISOString(), expiresAt = new Date(Date.now() + 180000).toISOString();
    const shiftId = input.mode === 'en_route' && typeof input.shiftId === 'string' ? input.shiftId : null;
    if (input.mode === 'en_route' && !shiftId) throw new SignupError('Choose your confirmed shift.');
    const result = await db.prepare(`INSERT INTO officer_dispatch_consents(owner_user_id,officer_id,revision,session_id,active,mode,shift_id,expires_at,updated_at) SELECT ?,?,?,?,1,?,?,?,? WHERE ?=0 AND NOT EXISTS(SELECT 1 FROM officer_dispatch_consents WHERE owner_user_id=?) ON CONFLICT(owner_user_id) DO NOTHING`).bind(actor.userId, officer.results[0].id, revision, sessionId, input.mode, shiftId, expiresAt, now, input.expectedRevision, actor.userId).run();
    if (!result.meta.changes) {
      const updated = await db.prepare(`UPDATE officer_dispatch_consents SET officer_id=?,revision=?,session_id=?,active=1,mode=?,shift_id=?,expires_at=?,updated_at=? WHERE owner_user_id=? AND revision=?`).bind(officer.results[0].id, revision, sessionId, input.mode, shiftId, expiresAt, now, actor.userId, input.expectedRevision).run();
      if (!updated.meta.changes) throw new SignupError('Sharing changed. Refresh before continuing.', 409);
    }
    return { message: 'Location sharing allowed for three minutes.' };
  }
  if (input.action !== 'publish_location') throw new SignupError('Choose a supported location action.');
  const point = validateSharedLocation(input), consent = await ownLocationConsent(db, actor);
  if (!consent?.active || consent.sessionId !== input.sessionId || consent.revision !== input.revision) throw new SignupError('Location sharing ended or changed. Allow a new session.', 409);
  await db.prepare(`INSERT INTO officer_dispatch_locations(owner_user_id,revision,session_id,latitude,longitude,accuracy_meters,captured_at,expires_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner_user_id) DO UPDATE SET revision=excluded.revision,session_id=excluded.session_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,captured_at=excluded.captured_at,expires_at=excluded.expires_at`).bind(actor.userId, consent.revision, consent.sessionId, point.latitude, point.longitude, point.accuracy, point.capturedAt, consent.expiresAt).run();
  return { message: 'Your current location is shared.' };
}
export async function readDispatchLocations(db: D1Database): Promise<ZoneMapPoint[]> { return (await db.prepare(projection + live + ' ORDER BY p.captured_at DESC LIMIT 500').all<ZoneMapPoint>()).results; }
export async function readClientRoute(db: D1Database, actor: SigningActor, shiftId: string) {
  if (actor.operations) throw new SignupError('Open your Client Zone.', 403);
  const shift = await db.prepare(`SELECT s.officer_id AS officerId,os.latitude_e6/1000000.0 AS latitude,os.longitude_e6/1000000.0 AS longitude,b.site_name AS name FROM shifts s JOIN bookings b ON b.id=s.booking_id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id JOIN roster_assignments a ON a.shift_id=s.id AND a.status='confirmed' AND a.active_key=a.roster_slot_id JOIN roster_slots r ON r.id=a.roster_slot_id JOIN operational_sites os ON os.id=r.site_id WHERE s.id=? AND l.owner_user_id=? AND s.environment='production' AND s.integrity_state='production_verified' AND b.environment='production'`).bind(shiftId, actor.userId).first<{ officerId: string; latitude: number; longitude: number; name: string }>();
  if (!shift) throw new SignupError('Your assigned shift was not found.', 404);
  const points = (await db.prepare(projection + live + " AND c.mode='en_route' AND c.shift_id=? AND o.id=? LIMIT 1").bind(shiftId, shift.officerId).all<ZoneMapPoint>()).results;
  return { points, site: { latitude: shift.latitude, longitude: shift.longitude, name: shift.name }, checkedAt: new Date().toISOString() };
}
export async function purgeExpiredZoneLocations(db: D1Database) { await db.prepare("DELETE FROM officer_dispatch_locations WHERE julianday(expires_at)<=julianday('now') OR julianday(captured_at)<julianday('now','-2 minutes')").run(); }
