import { configuredEmailProvider, emailValid, isSmtpProvider, sameEmailProvider, sendEmail, DeliveryError, type EmailProvider, type OperationalRuntime } from "./operational-provider";

type DeliveryJob = { id: string; state: string; request_json: string | null; updated_at: string; lease_expires_at: string | null; first_attempt_at: string | null; attempts: number };
export type EnquiryNotification = { notificationStatus: "sent" | "pending" | "failed"; confirmationEmailSent: boolean; opsEmailSent: boolean };
const outcome = (sent: boolean, pending = false): EnquiryNotification => ({ notificationStatus: sent ? "sent" : pending ? "pending" : "failed", confirmationEmailSent: sent, opsEmailSent: sent });

/** Uses the enquiry's existing outbox row for a frozen pair of messages (team notice and visitor confirmation). */
export async function deliverEnquiryEmails(db: D1Database, runtime: OperationalRuntime, enquiryId: string, transport: typeof fetch = fetch, clock = Date.now()): Promise<EnquiryNotification> {
  const job = await db.prepare("SELECT id,state,request_json,updated_at,lease_expires_at,first_attempt_at,attempts FROM operational_delivery_jobs WHERE source_id=? AND kind='enquiry_email'").bind(enquiryId).first<DeliveryJob>();
  if (!job || job.state === "cancelled") return outcome(false);
  let storedBody: Record<string, unknown> | undefined;
  try { if (job.request_json) storedBody = JSON.parse(job.request_json); } catch { return outcome(false); }
  if (job.state === "sent" || job.state === "delivered") {
    // Older outbox messages notified operations only. Their receipt cannot
    // confirm a visitor message that was never part of that delivery.
    return outcome((storedBody?._lokdProvider === "resend" || isSmtpProvider(storedBody?._lokdProvider)) && !!storedBody?._lokdConfirmation);
  }
  if (job.state === "dispatching" && job.lease_expires_at && Date.parse(job.lease_expires_at) > clock) return outcome(false, true);
  const now = new Date(Math.max(clock, Date.parse(job.updated_at) + 1)).toISOString();
  async function blocked(reason: string) {
    await db.prepare("UPDATE operational_delivery_jobs SET state='blocked',last_error=?,updated_at=? WHERE id=? AND updated_at=? AND state NOT IN ('sent','delivered','cancelled')").bind(reason, now, job!.id, job!.updated_at).run();
    return outcome(false);
  }
  let provider: EmailProvider;
  try { provider = configuredEmailProvider(runtime); } catch { return blocked("Configure the email mailbox (LOKD_SMTP_HOST, LOKD_SMTP_USER, LOKD_SMTP_PASSWORD) or RESEND_API_KEY, plus LOKD_EMAIL_FROM and LOKD_TEAM_EMAIL."); }
  if (!emailValid(runtime.LOKD_EMAIL_FROM)) return blocked("Configure LOKD_EMAIL_FROM and LOKD_TEAM_EMAIL.");
  // SMTP has no idempotent replay: after any SMTP attempt, Operations checks the sent mailbox.
  if (job.attempts > 0 && (isSmtpProvider(storedBody?._lokdProvider) || !storedBody && provider === "smtp")) return outcome(false);
  // Preserve the provider's 24-hour deduplication window after a lost response.
  if (job.attempts >= 5 || job.first_attempt_at && clock - Date.parse(job.first_attempt_at) >= 23 * 3600000) return blocked("Review the original email delivery before sending again; the retry window has ended.");
  const enquiry = await db.prepare("SELECT contact_name,email_normalized,organisation_name,service_type,site_area,message,engagement_model FROM client_enquiries WHERE id=? AND integrity_state='user_submitted'").bind(enquiryId).first<{ contact_name: string; email_normalized: string; organisation_name: string; service_type: string; site_area: string; message: string; engagement_model: string | null }>();
  if (!enquiry || !emailValid(enquiry.email_normalized)) return blocked("The enquiry recipient could not be confirmed.");
  const from = runtime.LOKD_EMAIL_FROM, to = enquiry.engagement_model ? "bookings@lokd.co.za" : runtime.LOKD_TEAM_EMAIL;
  if (!emailValid(to)) return blocked("Configure LOKD_TEAM_EMAIL.");
  const body: Record<string, unknown> = storedBody ?? {
    _lokdProvider: provider, from, to: [to], subject: enquiry.engagement_model ? "New LOKD booking request" : "New LOKD security enquiry",
    text: "A security enquiry is ready for review.\n\nReference: " + enquiryId + "\nOrganisation: " + enquiry.organisation_name + "\nContact: " + enquiry.contact_name + "\nEmail: " + enquiry.email_normalized + "\nArea: " + enquiry.site_area + "\nService: " + enquiry.service_type.replaceAll("_", " ") + "\n\n" + enquiry.message + "\n\nReview and follow up in Operations:\nhttps://operations.lokd.co.za/ops/intake?kind=client\n\nLOKD Security",
    _lokdConfirmation: { from, to: [enquiry.email_normalized], subject: "We have your LOKD enquiry",
      text: "Hello " + enquiry.contact_name + ",\n\nThank you for contacting LOKD. We have saved your booking request. LOKD Operations will confirm the officers and the price with you. Your request does not confirm cover.\n\nYour reference: " + enquiryId + "\n\nOpen the Client Zone using this email to follow your request:\nhttps://portal.lokd.co.za\n\nCover is confirmed only after you and LOKD agree the service details and price. For questions, reply to " + to + ".\n\nLOKD Security\nSecurity on your terms.\nhttps://lokd.co.za" },
  };
  if (!sameEmailProvider(body._lokdProvider, provider) || !body._lokdConfirmation) return blocked("This delivery uses a different saved provider or message. Review the original delivery.");
  const lease = crypto.randomUUID();
  const claimed = await db.prepare("UPDATE operational_delivery_jobs SET state='dispatching',attempts=attempts+1,request_json=coalesce(request_json,?),recipient=coalesce(recipient,?),first_attempt_at=coalesce(first_attempt_at,?),lease_token=?,lease_expires_at=?,updated_at=?,last_error=NULL WHERE id=? AND updated_at=? AND state NOT IN ('sent','delivered','cancelled')").bind(JSON.stringify(body), to, now, lease, new Date(clock + 60000).toISOString(), now, job.id, job.updated_at).run();
  if (!claimed.meta.changes) return outcome(false, true);
  try {
    const providerId = await sendEmail(runtime, job.id, body, transport);
    const stamp = new Date().toISOString();
    const persisted = await db.batch([
      db.prepare("UPDATE operational_delivery_jobs SET state='sent',provider_id=?,lease_token=NULL,lease_expires_at=NULL,last_error=NULL,updated_at=?,next_attempt_at=? WHERE id=? AND lease_token=?").bind(providerId, stamp, new Date(clock + 3600000).toISOString(), job.id, lease),
      db.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT ?,'system','enquiry-notifications','public_enquiry_emails_sent','client_enquiry',?,?,? WHERE changes()=1").bind("AUD-" + crypto.randomUUID(), enquiryId, JSON.stringify({ provider, providerId }), stamp),
    ]);
    return outcome(!!persisted[0].meta.changes, !persisted[0].meta.changes);
  } catch (cause) {
    const reason = cause instanceof DeliveryError ? cause.code : "email_delivery_unconfirmed";
    // A lost SMTP reply may mean the message was sent; it is never retried automatically.
    const state = provider === "smtp" ? cause instanceof DeliveryError && (cause.disposition === "failed" || cause.disposition === "blocked") ? cause.disposition : "uncertain" : "retry_wait";
    await db.prepare("UPDATE operational_delivery_jobs SET state=?,last_error=?,lease_token=NULL,lease_expires_at=NULL,updated_at=?,next_attempt_at=? WHERE id=? AND lease_token=?").bind(state, reason, new Date().toISOString(), new Date(clock + 60000).toISOString(), job.id, lease).run();
    return outcome(false);
  }
}
