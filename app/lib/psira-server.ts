import { PsiraError, psiraNumber, reviewEvidence, verificationState, type PsiraCase, type PsiraEvent } from './psira-verification';
export type PsiraActor = { userId: string; email: string; operations: boolean };
type CaseRow = Omit<PsiraCase, 'events' | 'verified' | 'recheckDue'>;
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), v => v.toString(16).padStart(2,'0')).join('');
}
export async function readPsiraCases(db: D1Database, actor: PsiraActor) {
  const cases = await db.prepare(`SELECT * FROM psira_verification_cases ${actor.operations ? '' : 'WHERE owner_user_id = ?'} ORDER BY updated_at DESC LIMIT 200`).bind(...(actor.operations ? [] : [actor.userId])).all<CaseRow>();
  return Promise.all(cases.results.map(async row => {
    const events = (await db.prepare('SELECT * FROM psira_verification_events WHERE case_id = ? ORDER BY version DESC').bind(row.id).all<PsiraEvent>()).results;
    return { ...row, events, ...verificationState(events[0]) };
  }));
}
export async function writePsiraCase(db: D1Database, actor: PsiraActor, body: Record<string, unknown>) {
  const now = new Date().toISOString();
  const action = body.action;
  if (!['submit','recheck','review'].includes(String(action))) throw new PsiraError('Choose a verification action.');
  const current = action === 'submit'
    ? await db.prepare('SELECT * FROM psira_verification_cases WHERE owner_user_id = ?').bind(actor.userId).first<CaseRow>()
    : await db.prepare('SELECT * FROM psira_verification_cases WHERE id = ?').bind(String(body.caseId ?? '')).first<CaseRow>();
  if (action !== 'submit' && !current) throw new PsiraError('Verification record not found.',404);
  if (current && !actor.operations && current.owner_user_id !== actor.userId) throw new PsiraError('This verification belongs to another account.',403);
  if (action === 'review' && !actor.operations) throw new PsiraError('Only Operations can record source checks and identity decisions.',403);
  if (action === 'review' && current?.owner_user_id === actor.userId) throw new PsiraError('Another Operations reviewer must review your own registration.',403);
  if (current && body.expectedVersion !== current.version) throw new PsiraError('This record changed. Refresh before continuing.',409);
  const number = action === 'submit' ? psiraNumber(body.psiraNumber) : current!.psira_number;
  const review = action === 'review' ? reviewEvidence(body, number) : null;
  const evidence = JSON.stringify(review?.evidence ?? { reason: action === 'submit' ? 'Officer submitted number; no registration or identity conclusion.' : 'Recheck requested; previous verification no longer current.' });
  const caseId = current?.id ?? crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const version = (current?.version ?? 0) + 1;
  const mutation = current
    ? db.prepare('UPDATE psira_verification_cases SET psira_number = ?, version = ?, latest_event_id = ?, updated_at = ? WHERE id = ? AND version = ?').bind(number,version,eventId,now,caseId,current.version)
    : db.prepare('INSERT OR IGNORE INTO psira_verification_cases (id,owner_user_id,owner_email,psira_number,version,latest_event_id,updated_at) VALUES (?,?,?,?,?,?,?)').bind(caseId,actor.userId,actor.email,number,version,eventId,now);
  const results = await db.batch([
    mutation,
    db.prepare(`INSERT INTO psira_verification_events (id,case_id,version,psira_number,kind,registration_status,identity_match,evidence_json,evidence_hash,recorded_by,recorded_at,recheck_at)
      SELECT ?,id,?,?,?,?,?,?,?,?,?,? FROM psira_verification_cases WHERE id = ? AND latest_event_id = ?`)
      .bind(eventId,version,number,String(action),review?.registration ?? 'pending_review',review?.identity ?? 'unchecked',evidence,await hash(evidence),actor.email,now,review?.recheckAt ?? null,caseId,eventId),
  ]);
  if (!results[0].meta.changes || !results[1].meta.changes) throw new PsiraError('This record changed. Refresh before continuing.',409);
  return caseId;
}
