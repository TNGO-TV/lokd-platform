import { SignupError } from './signup-server';
import type { SigningActor } from './production-signing';
import { trainingCourse } from './training-courses';
import type { TrainingSession, TrainingEnrolment, TrainingCompletionReview, TrainingCertificate, TrainingRenewalRequest, ZoneTrainingState } from './zone-training-types';
import { emailValid } from './operational-provider';

function text(value: unknown, label: string, min = 3, max = 1000) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new SignupError('Enter ' + label + '.');
  return value.trim();
}
function key(value: unknown) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new SignupError('Refresh this form before submitting.'); return value.toLowerCase(); }
function operations(actor: SigningActor) { if (!actor.operations) throw new SignupError('Operations access required.', 403); }
function audit(db: D1Database, actor: SigningActor, event: string, id: string, command: string, detail: unknown, table: string) {
  return db.prepare(`INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${table} WHERE id=? AND last_event_id=?)`).bind(command, actor.operations ? 'operations' : 'officer', actor.userId, event, 'training', id, JSON.stringify(detail), new Date().toISOString(), id, command);
}
async function changed(db: D1Database, update: D1PreparedStatement, log: D1PreparedStatement, rest: D1PreparedStatement[] = []) {
  const result = await db.batch([update, ...rest, log]);
  if (result[0]?.meta.changes !== 1) throw new SignupError('This training record changed. Refresh before continuing.', 409);
}
function notification(db: D1Database, command: string, table: string, id: string, recipient: string, message: string) {
  if (!emailValid(recipient)) throw new SignupError('A valid account email is required.');
  const now = new Date().toISOString();
  return db.prepare(`INSERT OR IGNORE INTO officer_email_outbox(id,recipient,subject,message,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${table} WHERE id=? AND last_event_id=?)`).bind('zone-training:' + command, recipient, 'LOKD | Training update', message + '\n\nView Training in your Officer Zone: https://officers.lokd.co.za/officer/training\n\nLOKD Security', now, now, id, command);
}
async function enrolment(db: D1Database, id: unknown) {
  const row = await db.prepare('SELECT id,owner_user_id,owner_email,course_id,session_id,status,attendance,version FROM zone_training_enrolments WHERE id=?').bind(text(id, 'the enrolment reference')).first<{ id: string; owner_user_id: string; owner_email: string; course_id: string; session_id: string | null; status: string; attendance: string; version: number }>();
  if (!row) throw new SignupError('Enrolment not found.', 404); return row;
}
export async function readZoneTraining(db: D1Database, actor: SigningActor): Promise<ZoneTrainingState> {
  const own = actor.operations ? '' : 'WHERE e.owner_user_id=?', args = actor.operations ? [] : [actor.userId];
  const [sessions, enrolments, completions, certificates, renewals] = await Promise.all([
    db.prepare(`SELECT s.id,s.course_id AS courseId,s.starts_at AS startsAt,s.ends_at AS endsAt,s.venue,s.capacity,s.status,s.version,
      (SELECT count(*) FROM zone_training_enrolments e WHERE e.session_id=s.id AND e.status IN ('confirmed','completion_pending','completed')) AS seatsTaken${actor.operations ? ',s.fee_cents AS feeCents,s.fee_terms AS feeTerms' : ''}
      FROM zone_training_sessions s ${actor.operations ? '' : "WHERE s.status='published' AND julianday(s.starts_at)>julianday('now')"} ORDER BY s.starts_at DESC LIMIT 200`).all<TrainingSession>(),
    db.prepare(`SELECT e.id,e.owner_user_id AS ownerUserId,e.full_name AS fullName,e.course_id AS courseId,e.session_id AS sessionId,e.status,e.attendance,e.version,e.created_at AS createdAt,s.starts_at AS startsAt,s.ends_at AS endsAt,s.venue${actor.operations ? ',e.owner_email AS ownerEmail,e.agreed_fee_cents AS agreedFeeCents,e.agreed_fee_terms AS agreedFeeTerms' : ''}
      FROM zone_training_enrolments e LEFT JOIN zone_training_sessions s ON s.id=e.session_id ${own} ORDER BY e.created_at DESC LIMIT 300`).bind(...args).all<TrainingEnrolment>(),
    actor.operations ? db.prepare('SELECT id,enrolment_id AS enrolmentId,source_version AS sourceVersion,assessment_reference AS assessmentReference,evidence_sha256 AS evidenceSha256,certificate_number AS certificateNumber,certificate_reference AS certificateReference,prepared_by AS preparedBy,decision,version FROM zone_training_completion_reviews ORDER BY created_at DESC LIMIT 200').all<TrainingCompletionReview>() : Promise.resolve({ results: [] }),
    db.prepare(`SELECT c.id,c.enrolment_id AS enrolmentId,e.course_id AS courseId,c.certificate_number AS certificateNumber,c.certificate_reference AS certificateReference,c.issued_at AS issuedAt FROM zone_training_certificates c JOIN zone_training_enrolments e ON e.id=c.enrolment_id ${own} ORDER BY c.issued_at DESC LIMIT 200`).bind(...args).all<TrainingCertificate>(),
    db.prepare(`SELECT id,owner_user_id AS ownerUserId,note,status,public_note AS publicNote,version,created_at AS createdAt${actor.operations ? ',owner_email AS ownerEmail' : ''} FROM zone_training_renewal_requests ${actor.operations ? '' : 'WHERE owner_user_id=?'} ORDER BY created_at DESC LIMIT 200`).bind(...args).all<TrainingRenewalRequest>(),
  ]);
  return { sessions: sessions.results, enrolments: enrolments.results, completions: completions.results, certificates: certificates.results, renewals: renewals.results, viewerUserId: actor.userId, isOwner: actor.owner, checkedAt: new Date().toISOString() };
}
export async function operateZoneTraining(db: D1Database, actor: SigningActor, input: Record<string, unknown>) {
  const now = new Date().toISOString(), command = crypto.randomUUID(), action = input.action;
  if (action === 'request_enrolment') {
    if (actor.operations) throw new SignupError('Use your own Officer Zone to book training.', 403);
    if (input.trainingAcknowledged !== true) throw new SignupError('Acknowledge the paid training terms and that course completion does not guarantee work.');
    const course = trainingCourse(input.courseId); if (!course) throw new SignupError('Choose a course.');
    const requestId = key(input.requestId), name = text(input.fullName, 'your full name', 3, 100), sessionId = input.sessionId ? text(input.sessionId, 'a session') : null;
    const prior = await db.prepare('SELECT id,course_id,session_id,full_name FROM zone_training_enrolments WHERE owner_user_id=? AND request_id=?').bind(actor.userId, requestId).first<{ id: string; course_id: string; session_id: string | null; full_name: string }>();
    if (prior) { if (prior.course_id !== course.id || prior.session_id !== sessionId || prior.full_name !== name) throw new SignupError('This submission was already used for different details.', 409); return { id: prior.id, message: 'Your training request is saved.' }; }
    if (sessionId && !await db.prepare("SELECT id FROM zone_training_sessions WHERE id=? AND course_id=? AND status='published' AND julianday(starts_at)>julianday(?)").bind(sessionId, course.id, now).first()) throw new SignupError('That session is no longer available. Choose another session.', 409);
    const id = 'ENROL-' + crypto.randomUUID();
    await db.batch([db.prepare('INSERT INTO zone_training_enrolments(id,request_id,owner_user_id,owner_email,full_name,course_id,session_id,last_event_id,created_at,updated_at,retention_review_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id, requestId, actor.userId, actor.email, name, course.id, sessionId, command, now, now, new Date(Date.now() + 365 * 86_400_000).toISOString()), audit(db, actor, 'training_enrolment_requested', id, command, { courseId: course.id, sessionId }, 'zone_training_enrolments'), notification(db, command, 'zone_training_enrolments', id, actor.email, 'Your request for ' + course.name + ' is saved. The training team will confirm eligibility, dates and the paid-course agreement. Training does not guarantee work.')]);
    return { id, message: 'Your place has been requested. The training team will confirm eligibility, session details and the paid course agreement.' };
  }
  if (action === 'request_renewal_help') {
    if (actor.operations) throw new SignupError('Use your own Officer Zone to request help.', 403);
    const requestId = key(input.requestId), note = text(input.note, 'your renewal question', 10, 2000);
    const prior = await db.prepare('SELECT id,note FROM zone_training_renewal_requests WHERE owner_user_id=? AND request_id=?').bind(actor.userId, requestId).first<{ id: string; note: string }>();
    if (prior) { if (prior.note !== note) throw new SignupError('This submission was already used for different details.', 409); return { id: prior.id, message: 'Your renewal support request is saved.' }; }
    const id = 'RENEWAL-' + crypto.randomUUID();
    await db.batch([db.prepare('INSERT INTO zone_training_renewal_requests(id,request_id,owner_user_id,owner_email,note,last_event_id,created_at,updated_at,retention_review_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, requestId, actor.userId, actor.email, note, command, now, now, new Date(Date.now() + 365 * 86_400_000).toISOString()), audit(db, actor, 'training_renewal_help_requested', id, command, {}, 'zone_training_renewal_requests'), notification(db, command, 'zone_training_renewal_requests', id, actor.email, 'Your renewal support request is with the training team. PSIRA decides registration and renewal outcomes.')]);
    return { id, message: 'Your renewal support request is with the training team.' };
  }
  operations(actor);
  if (action !== 'create_session' && (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1)) throw new SignupError('Choose the current training record version.');
  if (action === 'create_session') {
    const course = trainingCourse(input.courseId); if (!course) throw new SignupError('Choose a course.');
    const start = typeof input.startsAt === 'string' ? Date.parse(input.startsAt) : NaN, end = typeof input.endsAt === 'string' ? Date.parse(input.endsAt) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 86_400_000) throw new SignupError('Choose valid future session dates.');
    if (!Number.isSafeInteger(input.capacity) || Number(input.capacity) < 1 || Number(input.capacity) > 200) throw new SignupError('Choose a capacity from 1 to 200.');
    const venue = text(input.venue, 'the venue', 3, 300), id = 'SESSION-' + crypto.randomUUID(), requestId = key(input.requestId);
    const prior = await db.prepare('SELECT id,course_id,starts_at,ends_at,venue,capacity FROM zone_training_sessions WHERE created_by=? AND request_id=?').bind(actor.userId, requestId).first<{ id: string; course_id: string; starts_at: string; ends_at: string; venue: string; capacity: number }>();
    if (prior) { if (prior.course_id !== course.id || prior.starts_at !== new Date(start).toISOString() || prior.ends_at !== new Date(end).toISOString() || prior.venue !== venue || prior.capacity !== input.capacity) throw new SignupError('This submission was already used for different details.', 409); return { id: prior.id, message: 'Session draft already saved.' }; }
    if(start<=Date.now())throw new SignupError('Choose valid future session dates.');
    await db.batch([db.prepare('INSERT INTO zone_training_sessions(id,request_id,course_id,starts_at,ends_at,venue,capacity,created_by,updated_by,last_event_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, requestId, course.id, new Date(start).toISOString(), new Date(end).toISOString(), venue, input.capacity, actor.userId, actor.userId, command, now, now), audit(db, actor, 'training_session_created', id, command, { courseId: course.id }, 'zone_training_sessions')]);
    return { id, message: 'Session draft created. Review the fee and course agreement before publishing.' };
  }
  if (action === 'publish_session') {
    if (input.feeApproved !== true || !Number.isSafeInteger(input.feeCents) || Number(input.feeCents) <= 0 || Number(input.feeCents) > 10_000_000) throw new SignupError('Record the reviewed paid-course fee before publishing.');
    const id = text(input.id, 'the session reference'), terms = text(input.feeTerms, 'the reviewed course payment terms', 10, 2000);
    await changed(db, db.prepare("UPDATE zone_training_sessions SET status='published',fee_cents=?,fee_terms=?,updated_by=?,version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND status='draft' AND julianday(starts_at)>julianday(?)").bind(input.feeCents, terms, actor.userId, command, now, id, input.expectedVersion, now), audit(db, actor, 'training_session_published', id, command, {}, 'zone_training_sessions'));
    return { id, message: 'Session published.' };
  }
  if (action === 'confirm_enrolment') {
    const row = await enrolment(db, input.id);
    if (row.owner_user_id === actor.userId) throw new SignupError('Another operator must confirm your enrolment.', 403);
    if (input.eligibilityChecked !== true || input.feeAgreed !== true) throw new SignupError('Check course eligibility and the applicant’s paid-course agreement first.');
    const sessionId = text(input.sessionId, 'the session'), reference = text(input.eligibilityReference, 'the eligibility and agreement reference');
    const session = await db.prepare("SELECT fee_cents,fee_terms FROM zone_training_sessions WHERE id=? AND course_id=? AND status='published' AND julianday(starts_at)>julianday(?)").bind(sessionId, row.course_id, now).first<{ fee_cents: number; fee_terms: string }>();
    if (!session) throw new SignupError('Choose a current published session for this course.', 409);
    await changed(db, db.prepare("UPDATE zone_training_enrolments SET session_id=?,status='confirmed',agreed_fee_cents=?,agreed_fee_terms=?,eligibility_reference=?,confirmed_by=?,version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND status='requested'").bind(sessionId, session.fee_cents, session.fee_terms, reference, actor.userId, command, now, row.id, input.expectedVersion), audit(db, actor, 'training_enrolment_confirmed', row.id, command, { sessionId }, 'zone_training_enrolments'), [notification(db, command, 'zone_training_enrolments', row.id, row.owner_email, 'Your ' + (trainingCourse(row.course_id)?.name ?? 'course') + ' enrolment is confirmed. View your session and venue in Training. Completing training does not guarantee work.')]);
    return { id: row.id, message: 'Enrolment confirmed. No payment was collected by this action.' };
  }
  if (action === 'record_attendance') {
    const row = await enrolment(db, input.id); if (row.owner_user_id === actor.userId) throw new SignupError('Another operator must record your attendance.', 403);
    if (!['present', 'absent', 'excused'].includes(String(input.attendance))) throw new SignupError('Choose an attendance outcome.');
    const reference = text(input.reference, 'the attendance reference');
    await changed(db, db.prepare("UPDATE zone_training_enrolments SET attendance=?,attendance_by=?,attendance_reference=?,version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND status='confirmed' AND EXISTS(SELECT 1 FROM zone_training_sessions s WHERE s.id=session_id AND julianday(s.starts_at)<=julianday(?))").bind(input.attendance, actor.userId, reference, command, now, row.id, input.expectedVersion, now), audit(db, actor, 'training_attendance_recorded', row.id, command, { attendance: input.attendance }, 'zone_training_enrolments'));
    return { id: row.id, message: 'Attendance recorded. Course completion is reviewed separately.' };
  }
  if (action === 'prepare_completion') {
    const row = await enrolment(db, input.id); if (row.owner_user_id === actor.userId) throw new SignupError('Another assessor must review your course outcome.', 403);
    if (input.assessmentPassed !== true || row.attendance !== 'present') throw new SignupError('Confirmed attendance and a passed assessment are required.');
    const assessment = text(input.assessmentReference, 'the assessment reference'), hash = text(input.evidenceSha256, 'the evidence SHA-256');
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new SignupError('Enter the exact evidence SHA-256.');
    const number = text(input.certificateNumber, 'the certificate number', 3, 100), reference = text(input.certificateReference, 'the actual certificate record reference'), id = 'COMPLETION-' + crypto.randomUUID();
    await changed(db, db.prepare("UPDATE zone_training_enrolments SET status='completion_pending',version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND status='confirmed' AND attendance='present' AND EXISTS(SELECT 1 FROM zone_training_sessions s WHERE s.id=session_id AND julianday(s.ends_at)<=julianday(?))").bind(command, now, row.id, input.expectedVersion, now), audit(db, actor, 'training_completion_prepared', row.id, command, { reviewId: id }, 'zone_training_enrolments'), [db.prepare("INSERT INTO zone_training_completion_reviews(id,enrolment_id,source_version,assessment_reference,evidence_sha256,certificate_number,certificate_reference,prepared_by,last_event_id,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM zone_training_enrolments WHERE id=? AND last_event_id=?)").bind(id, row.id, row.version, assessment, hash, number, reference, actor.userId, command, now, row.id, command)]);
    return { id, message: 'Completion prepared for independent review. No certificate or work eligibility has been granted.' };
  }
  if (action === 'decide_completion') {
    if (!actor.owner) throw new SignupError('An independent Operations owner must review this completion.', 403);
    const id = text(input.id, 'the completion review reference'), reason = text(input.reason, 'the review findings');
    if (!['approved', 'rejected'].includes(String(input.decision)) || input.independentlyInspected !== true) throw new SignupError('Independently inspect the assessment and certificate evidence.');
    const row = await db.prepare('SELECT r.*,e.owner_user_id FROM zone_training_completion_reviews r JOIN zone_training_enrolments e ON e.id=r.enrolment_id WHERE r.id=?').bind(id).first<{ enrolment_id: string; source_version: number; prepared_by: string; owner_user_id: string; certificate_number: string; certificate_reference: string }>();
    if (!row) throw new SignupError('Completion review not found.', 404);
    if (row.prepared_by === actor.userId || row.owner_user_id === actor.userId) throw new SignupError('An independent reviewer must decide this completion.', 403);
    const approved = input.decision === 'approved';
    await changed(db, db.prepare("UPDATE zone_training_completion_reviews SET decision=?,decided_by=?,reason=?,decided_at=?,version=version+1,last_event_id=? WHERE id=? AND version=? AND decision='pending' AND EXISTS(SELECT 1 FROM zone_training_enrolments e WHERE e.id=enrolment_id AND e.version=source_version+1 AND e.status='completion_pending' AND e.attendance='present')").bind(input.decision, actor.userId, reason, now, command, id, input.expectedVersion), audit(db, actor, 'training_completion_decided', id, command, { decision: input.decision }, 'zone_training_completion_reviews'), [db.prepare("UPDATE zone_training_enrolments SET status=?,version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM zone_training_completion_reviews WHERE id=? AND last_event_id=?)").bind(approved ? 'completed' : 'confirmed', command, now, row.enrolment_id, row.source_version + 1, id, command), ...(approved ? [db.prepare("INSERT INTO zone_training_certificates(id,enrolment_id,completion_review_id,certificate_number,certificate_reference,issued_at,issued_by) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM zone_training_completion_reviews WHERE id=? AND last_event_id=?)").bind('CERT-' + crypto.randomUUID(), row.enrolment_id, id, row.certificate_number, row.certificate_reference, now, actor.userId, id, command)] : [])]);
    return { id, message: approved ? 'Completion and certificate record approved. Work eligibility is unchanged.' : 'Completion returned for review.' };
  }
  if (action === 'review_renewal') {
    const id = text(input.id, 'the renewal reference'), note = text(input.publicNote, 'the officer update', 10, 2000);
    if (!['under_review', 'closed'].includes(String(input.status))) throw new SignupError('Choose a renewal support status.');
    await changed(db, db.prepare("UPDATE zone_training_renewal_requests SET status=?,public_note=?,reviewed_by=?,version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND status!='closed' AND owner_user_id!=?").bind(input.status, note, actor.userId, command, now, id, input.expectedVersion, actor.userId), audit(db, actor, 'training_renewal_support_reviewed', id, command, {}, 'zone_training_renewal_requests'));
    return { id, message: 'Renewal support updated. PSIRA verification is unchanged.' };
  }
  throw new SignupError('Choose a supported training action.');
}
