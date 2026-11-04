import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export class ClientDatabase {
  constructor() {
    this.sql = new DatabaseSync(':memory:');
    this.sql.exec('PRAGMA foreign_keys=ON');
    for (const file of fs.readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort()) this.sql.exec(fs.readFileSync(`drizzle/${file}`, 'utf8'));
  }
  prepare(sql) {
    const db = this.sql;
    const statement = (values = []) => ({ sql, values, bind: (...bound) => statement(bound), first: async () => db.prepare(sql).get(...values) ?? null, all: async () => ({ results: db.prepare(sql).all(...values) }), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...values).changes) } }) });
    return statement();
  }
  async batch(statements) {
    if (this.beforeBatch) { const hook = this.beforeBatch; this.beforeBatch = null; hook(); }
    this.sql.exec('BEGIN IMMEDIATE');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); this.sql.exec('COMMIT'); return results; }
    catch (error) { this.sql.exec('ROLLBACK'); throw error; }
  }
}
export const client = { userId: 'client-fixture-a', email: 'client-a@example.test', operations: false, owner: false };
export const otherClient = { userId: 'client-fixture-b', email: 'client-b@example.test', operations: false, owner: false };
export function seedClient(db, actor = client, id = 'CLIENT-FIXTURE-A') {
  db.sql.prepare(`INSERT INTO clients(id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state) VALUES(?,?,?,?,'approved','production','production_verified')`).run(id, 'Local fixture organisation', 'Local fixture contact', actor.email);
  db.sql.prepare(`INSERT INTO production_entity_links(kind,case_id,case_version,owner_user_id,entity_id,prepared_by,prepared_at) VALUES('client',?,1,?,?,'fixture-operator',?)`).run('case-' + id, actor.userId, id, new Date().toISOString());
  return id;
}
export function seedBooking(db, clientId = 'CLIENT-FIXTURE-A', id = 'BOOKING-FIXTURE-A') {
  db.sql.prepare(`INSERT INTO bookings(id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,shift_start,shift_end,client_price_cents,officer_rate_cents,release_cadence,status,environment,integrity_state) VALUES(?,?,'Local fixture site','Cape Town','Gate','Unarmed','Grade C',0,'2090-01-01','2090-01-01','06:00','18:00',100000,50000,'Weekly','draft','production','production_verified')`).run(id, clientId);
  return id;
}
export function seedShift(db, bookingId = 'BOOKING-FIXTURE-A', id = 'SHIFT-FIXTURE-A', status = 'completed') {
  const officerId = 'OFFICER-' + id;
  db.sql.prepare(`INSERT INTO officers(id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry) VALUES(?,'Local fixture officer','0821234567','officer@example.test','Cape Town','1234567','Grade C','2099-01-01')`).run(officerId);
  db.sql.prepare(`INSERT INTO shifts(id,booking_id,officer_id,scheduled_date,status,check_in_at,check_out_at,earnings_cents,environment,integrity_state) VALUES(?,?,?,'2090-01-01',?,'2090-01-01T04:00:00.000Z','2090-01-01T05:30:00.000Z',50000,'production','production_verified')`).run(id, bookingId, officerId, status);
  return id;
}
export function clientRequest(path, actor = client, body) {
  return new Request('https://portal.lokd.co.za' + path, { method: body ? 'POST' : 'GET', headers: { origin: 'https://portal.lokd.co.za', 'content-type': 'application/json', ...(actor ? { 'x-lokd-verified-user-id': actor.userId, 'x-lokd-verified-email': actor.email } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
export function seedTimesheet(db, shiftId = 'SHIFT-FIXTURE-A', bookingId = 'BOOKING-FIXTURE-A') {
  const now = new Date().toISOString();
  db.sql.prepare(`INSERT INTO shift_timesheets(id,shift_id,booking_id,officer_id,service_date,scheduled_starts_at,scheduled_ends_at,scheduled_minutes,recorded_minutes,gross_wage_cents,calendar_category,policy_version,active_key,submitted_at,environment,integrity_state,created_at,updated_at) VALUES(?,?,?,?,'2090-01-01','2090-01-01T04:00:00Z','2090-01-01T05:30:00Z',90,90,50000,'ordinary','fixture-policy',?,?,'production','production_verified',?,?)`).run('TS-' + shiftId, shiftId, bookingId, 'OFFICER-' + shiftId, shiftId, now, now, now);
}
export function seedRoster(db, { bookingId = 'BOOKING-FIXTURE-A', clientId = 'CLIENT-FIXTURE-A', shiftId = 'SHIFT-FIXTURE-A', slotId = 'SLOT-FIXTURE-A', position = 1, assigned = true } = {}) {
  const siteId = 'SITE-' + bookingId, postId = 'POST-' + bookingId, now = new Date().toISOString();
  db.sql.prepare(`INSERT OR IGNORE INTO operational_sites(id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,environment,integrity_state,telemetry_mode) VALUES(?,?,?,'Local site','Cape Town','12 Main Road',-33900000,18400000,'production','production_verified','disabled')`).run(siteId, clientId, bookingId);
  db.sql.prepare(`INSERT OR IGNORE INTO site_posts(id,site_id,booking_id,name,environment,integrity_state) VALUES(?,?,?,'Gate','production','production_verified')`).run(postId, siteId, bookingId);
  db.sql.prepare(`INSERT INTO roster_slots(id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,position_index,environment,integrity_state) VALUES(?,?,?,?,'2090-01-01','2090-01-01T04:00:00Z','2090-01-01T16:00:00Z','2090-01-01T03:45:00Z','2090-01-01T04:00:00Z',?,'production','production_verified')`).run(slotId, siteId, postId, bookingId, position);
  if (assigned) db.sql.prepare(`INSERT INTO roster_assignments(id,roster_slot_id,officer_id,shift_id,status,active_key,assigned_by,assigned_at,confirmed_at,environment,integrity_state) VALUES(?,?,?,?,'confirmed',?,'fixture-operator',?,?,'production','production_verified')`).run('ASSIGNMENT-' + slotId, slotId, 'OFFICER-' + shiftId, shiftId, slotId, now, now);
  return slotId;
}
