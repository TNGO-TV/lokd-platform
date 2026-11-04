import { createClerkClient } from '@clerk/backend';
import { verifiedPrimaryEmail } from './clerk-access';
import { configuredEmailProvider, DeliveryError, emailValid, providerJson, sendEmail, type OperationalRuntime } from './operational-provider';

export type ClientNotificationRuntime = OperationalRuntime & { RESEND_API_KEY?: string };
export type ClientNotification = {
  id: string;
  sourceId: string;
  ownerUserId: string;
  recipient: 'client' | 'operations';
  subject: string;
  text: string;
  createdAt?: string;
};

// Include this statement in the same D1 batch as the business change.
export function clientNotificationStatement(db: D1Database, notice: ClientNotification) {
  if (!notice.id || notice.id.length > 200 || !notice.sourceId || !notice.ownerUserId || !notice.subject.trim() || notice.subject.length > 200 || !notice.text.trim() || notice.text.length > 20000) throw new Error('Notification details are invalid.');
  const now = notice.createdAt ?? new Date().toISOString();
  return db.prepare(`INSERT OR IGNORE INTO client_notification_jobs
    (id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(notice.id, notice.sourceId, notice.ownerUserId, notice.recipient, notice.subject, notice.text, now, now, now);
}

type Job = {
  id: string; source_id: string; owner_user_id: string; recipient_type: 'client' | 'operations';
  subject: string; message_text: string; attempts: number; request_json: string | null;
  recipient: string | null; first_attempt_at: string | null;
};
type DeliveryOptions = {
  ids?: string[];
  ownerUserId?: string;
  limit?: number;
  transport?: typeof fetch;
  verifiedEmail?: (userId: string) => Promise<string | null>;
  now?: () => number;
};

export async function readClientNotificationFailures(db:D1Database,ownerUserId:string){
  return (await db.prepare(`SELECT id,source_id AS sourceId,subject,state,last_error AS error,created_at AS createdAt
    FROM client_notification_jobs WHERE owner_user_id=? AND state NOT IN ('sent','cancelled') ORDER BY created_at DESC LIMIT 50`)
    .bind(ownerUserId).all<{id:string;sourceId:string;subject:string;state:string;error:string|null;createdAt:string}>()).results;
}

function readableError(error: unknown) {
  if (!(error instanceof DeliveryError)) return 'Email delivery is temporarily unavailable.';
  if (error.code === 'email_provider_not_configured') return 'Email is not configured. Contact LOKD Operations.';
  if (error.code === 'resend_key_not_configured') return 'Email is unavailable because RESEND_API_KEY is not configured. Contact LOKD Operations.';
  if (error.code === 'email_sender_not_configured') return 'The LOKD sender address is not configured.';
  if (error.code === 'email_recipient_unavailable') return 'A verified recipient email address is required.';
  if (error.code === 'signer_directory_unavailable') return 'The account email service is not configured.';
  if (error.code === 'email_recipient_changed') return 'The recipient address changed. Operations must review this email.';
  if (error.code === 'email_provider_changed') return 'Email configuration changed. Operations must review this email.';
  return error.disposition === 'uncertain' ? 'Email submission is unconfirmed. Operations must check delivery before retrying.' : 'Email delivery failed. Contact LOKD Operations.';
}

export async function deliverClientNotifications(db: D1Database, runtime: ClientNotificationRuntime, options: DeliveryOptions = {}, transportOverride?: typeof fetch) {
  const clock = options.now ?? Date.now;
  const transport = transportOverride ?? options.transport ?? fetch;
  const now = () => new Date(clock()).toISOString();
  const ids = options.ids?.slice(0, 20);
  if (ids && !ids.length) return { sent: 0, blocked: 0, uncertain: 0, failed: 0, pending: 0, errors: [] as string[] };
  const limit = Math.min(5, Math.max(1, Math.floor(options.limit ?? 5)));
  const filters = `${options.ownerUserId ? ' AND owner_user_id=?' : ''}${ids ? ` AND id IN (${ids.map(() => '?').join(',')})` : ''}`;
  const values = [...options.ownerUserId ? [options.ownerUserId] : [], ...ids ?? []];
  // Resend retries reuse the frozen request within its 24-hour deduplication window.
  // A lost SMTP worker can have sent the message; SMTP has no safe replay.
  await db.prepare(`UPDATE client_notification_jobs SET state=CASE WHEN attempts>0 AND
    (json_extract(request_json,'$._lokdProvider')!='resend' OR first_attempt_at<=? OR attempts>=5) THEN 'uncertain' ELSE 'retry_wait' END,
    lease_token=NULL,lease_expires_at=NULL,last_error='Email submission was interrupted. Operations must check any submitted message.',updated_at=?
    WHERE state='dispatching' AND lease_expires_at<=?${filters}`).bind(new Date(clock()-23*3600000).toISOString(),now(), now(), ...values).run();
  const jobs = await db.prepare(`SELECT * FROM client_notification_jobs WHERE state IN ('queued','blocked','retry_wait')
    ${ids ? '' : 'AND next_attempt_at<=?'}${filters} ORDER BY created_at,id LIMIT ?`)
    .bind(...ids ? [] : [now()], ...values, limit).all<Job>();
  const result = { sent: 0, blocked: 0, uncertain: 0, failed: 0, pending: 0, errors: [] as string[] };
  const resolveEmail = options.verifiedEmail ?? (async (userId: string) => {
    if (!runtime.CLERK_SECRET_KEY) throw new DeliveryError('signer_directory_unavailable');
    const user = await createClerkClient({ secretKey: runtime.CLERK_SECRET_KEY }).users.getUser(userId);
    return user.banned || user.locked ? null : verifiedPrimaryEmail(user);
  });
  for (const job of jobs.results) {
    const lease = crypto.randomUUID();
    const claimed = await db.prepare(`UPDATE client_notification_jobs SET state='dispatching',lease_token=?,lease_expires_at=?,updated_at=?
      WHERE id=? AND state IN ('queued','blocked','retry_wait')`)
      .bind(lease, new Date(clock() + 120000).toISOString(), now(), job.id).run();
    if (!claimed.meta.changes) continue;
    let attempted = false;
    let provider: string | null = null;
    try {
      if(runtime.LOKD_EMAIL_PROVIDER==='smtp'||runtime.LOKD_EMAIL_PROVIDER==='cpanel')provider=configuredEmailProvider(runtime);
      else if(!runtime.LOKD_EMAIL_PROVIDER||runtime.LOKD_EMAIL_PROVIDER==='resend'){
        if(!runtime.RESEND_API_KEY)throw new DeliveryError('resend_key_not_configured');
        provider='resend';
      }else throw new DeliveryError('email_provider_not_configured');
      const sender = runtime.LOKD_QUOTE_EMAIL_FROM ?? runtime.LOKD_EMAIL_FROM;
      if (!emailValid(sender)) throw new DeliveryError('email_sender_not_configured');
      const recipient = job.recipient_type === 'operations' ? runtime.LOKD_TEAM_EMAIL : await resolveEmail(job.owner_user_id);
      if (!emailValid(recipient)) throw new DeliveryError('email_recipient_unavailable');
      if (job.recipient && recipient.toLowerCase() !== job.recipient.toLowerCase()) throw new DeliveryError('email_recipient_changed');
      const body: Record<string, unknown> = job.request_json ? JSON.parse(job.request_json) : { from: sender, to: [recipient], subject: job.subject, text: job.message_text, _lokdProvider: provider };
      if (body._lokdProvider !== provider) throw new DeliveryError('email_provider_changed');
      if(job.attempts>=5||job.first_attempt_at&&clock()-Date.parse(job.first_attempt_at)>=23*3600000)throw new DeliveryError('email_retry_window_expired','uncertain');
      await db.prepare(`UPDATE client_notification_jobs SET request_json=COALESCE(request_json,?),recipient=COALESCE(recipient,?),
        attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),updated_at=? WHERE id=? AND lease_token=?`).bind(JSON.stringify(body), recipient, now(),now(), job.id, lease).run();
      attempted = true;
      // SMTP Message-ID is bounded and stable across process restarts.
      const messageId = 'client-' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(job.id))), b => b.toString(16).padStart(2, '0')).join('');
      let providerId:string;
      if(provider==='resend'){
        const response=await providerJson('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+runtime.RESEND_API_KEY,'content-type':'application/json','idempotency-key':messageId},body:JSON.stringify({from:body.from,to:body.to,subject:body.subject,text:body.text})},transport);
        if(typeof response.id!=='string'||!response.id||response.id.length>200)throw new DeliveryError('email_acceptance_unconfirmed','retry_wait');
        providerId='resend:'+response.id;
      }else providerId=await sendEmail(runtime,messageId,body,transport);
      const saved = await db.prepare(`UPDATE client_notification_jobs SET state='sent',provider_id=?,last_error=NULL,
        lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND lease_token=?`).bind(providerId, now(), job.id, lease).run();
      if (saved.meta.changes) result.sent++;
    } catch (error) {
      const state = error instanceof DeliveryError&&error.disposition==='uncertain'?'uncertain':attempted
        ? error instanceof DeliveryError && ['blocked', 'failed'].includes(error.disposition) ? error.disposition as 'blocked' | 'failed'
          : provider==='resend'&&job.attempts+1<5?'retry_wait':'uncertain'
        : 'blocked';
      // A definite provider rejection can be reviewed; unknown submission is never automatically resent.
      await db.prepare(`UPDATE client_notification_jobs SET state=?,last_error=?,lease_token=NULL,lease_expires_at=NULL,
        next_attempt_at=?,updated_at=? WHERE id=? AND lease_token=?`)
        .bind(state, readableError(error), new Date(clock() + 15 * 60000).toISOString(), now(), job.id, lease).run();
      if(state==='retry_wait')result.pending++;else result[state]++;
      result.errors.push(readableError(error));
    }
  }
  return result;
}
