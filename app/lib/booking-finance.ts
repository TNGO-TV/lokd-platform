import { SignupError } from './signup-server';
import { operateBookingCollection, readBookingCollections, type CollectionRuntime } from './booking-collections';
import { clientNotificationStatement } from './quote-notifications';
import type { SigningActor } from './production-signing';

export type BookingFinanceRuntime = CollectionRuntime & {
  LOKD_EFT_BANK_NAME?: string;
  LOKD_EFT_ACCOUNT_NAME?: string;
  LOKD_EFT_ACCOUNT_NUMBER?: string;
  LOKD_EFT_BRANCH_CODE?: string;
  LOKD_EFT_ACCOUNT_TYPE?: string;
};
export type InvoiceLine = { description: string; quantity: number; unitPriceCents: number; netCents: number; taxCents: number; grossCents: number };
type BillingParty = { legalName: string; address: string; registrationNumber: string; vatNumber: string };
export type ClientInvoice = {
  id: string; documentId: string; number: string; bookingId: string; issuedAt: string;
  dueDate: string | null; periodStart: string; periodEnd: string; currency: 'ZAR';
  subtotalCents: number; taxCents: number; totalCents: number; creditedCents: number;
  receivedCents: number; refundedCents: number; balanceCents: number;
  status: string; lines: InvoiceLine[]; issuer: BillingParty; client: BillingParty;
};
export type ClientCredit = { id: string; invoiceId: string; number: string; issuedAt: string; amountCents: number; netCents: number; taxCents: number; reason: string };
export type ClientReceipt = { id: string; bookingId: string; reference: string; provider: string; receivedAt: string; amountCents: number; refundedCents: number; status: string; current: boolean };
export type EftInstructions = { bank: string; accountName: string; accountNumber: string; branchCode: string; accountType: string; reference: string; amountCents: number; currency: 'ZAR' };
export type BookingFinanceData = {
  invoices: ClientInvoice[]; credits: ClientCredit[]; receipts: ClientReceipt[];
  collections: { reference: string; orderId: string; amountCents: number; state: string; revision: number; current: boolean; checkoutUrl: string | null }[];
  generatedAt: string;
};
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const cents = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new SignupError('This invoice needs a billing review. Please contact LOKD.', 409);
  return Number(value);
};
const party = (value: unknown): BillingParty => {
  const p = object(value);
  return { legalName: text(p.legalName), address: text(p.address), registrationNumber: text(p.registrationNumber), vatNumber: text(p.vatNumber) };
};
export function invoiceBalance(total: number, credited: number, received: number, refunded: number) {
  if (![total, credited, received, refunded].every(Number.isSafeInteger) || total < 0 || received < 0 || refunded < 0 || refunded > received) throw new SignupError('The account balance needs a billing review.', 409);
  const amount = total - credited - received + refunded;
  if (!Number.isSafeInteger(amount)) throw new SignupError('The account balance needs a billing review.', 409);
  return amount;
}
export function safeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://checkout.paystack.com' && !url.username && !url.password && !url.hash ? url.href : null;
  } catch { return null; }
}

export async function readClientFinance(db: D1Database, actor: SigningActor): Promise<BookingFinanceData> {
  if (actor.operations) throw new SignupError('Open your client account to view invoices.', 403);
  const [issued, credits, receipts, collections] = await Promise.all([
    db.prepare(`SELECT v.id AS documentId,v.source_id AS id,v.source_json,n.number,n.issued_at AS issuedAt
      FROM finance_document_versions v JOIN finance_document_issues n ON n.document_id=v.id
      JOIN client_invoices i ON i.id=v.source_id AND i.client_id=v.party_id
      JOIN production_entity_links l ON l.kind='client' AND l.entity_id=i.client_id AND l.owner_user_id=v.recipient_user
      WHERE v.kind='invoice' AND v.recipient_user=? AND i.environment='production' AND i.integrity_state='production_verified'
      AND NOT EXISTS(SELECT 1 FROM finance_document_versions newer JOIN finance_document_issues ni ON ni.document_id=newer.id
        WHERE newer.kind=v.kind AND newer.source_id=v.source_id AND newer.version>v.version)
      ORDER BY n.issued_at DESC,v.id`).bind(actor.userId).all<{ documentId: string; id: string; source_json: string; number: string; issuedAt: string }>(),
    db.prepare(`SELECT c.id,c.invoice_id AS invoiceId,n.number,n.issued_at AS issuedAt,c.direction*(c.net_cents+c.tax_cents) AS amountCents,c.direction*c.net_cents AS netCents,c.direction*c.tax_cents AS taxCents,json_extract(c.payload_json,'$.note') AS reason
      FROM credit_notes c JOIN credit_note_issues n ON n.credit_id=c.id JOIN client_invoices i ON i.id=c.invoice_id
      JOIN production_entity_links l ON l.kind='client' AND l.entity_id=i.client_id
      WHERE l.owner_user_id=? AND i.environment='production' AND i.integrity_state='production_verified' ORDER BY n.issued_at DESC,c.id`)
      .bind(actor.userId).all<ClientCredit>(),
    db.prepare(`SELECT f.id,f.booking_id AS bookingId,f.provider_reference AS reference,f.provider,
      COALESCE(f.reconciled_at,f.cleared_at) AS receivedAt,f.cleared_amount_cents AS amountCents,f.status,
      f.active_key=f.booking_id AS current,
      COALESCE((SELECT sum(r.bank_amount_minor) FROM booking_refund_receipts r JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved'
        JOIN booking_refund_cases c ON c.id=r.case_id WHERE c.reference=f.provider_reference),0) AS refundedCents
      FROM booking_funding_reconciliations f JOIN bookings b ON b.id=f.booking_id
      JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id
      WHERE l.owner_user_id=? AND f.environment='production' AND f.integrity_state='production_verified'
      AND b.environment='production' AND b.integrity_state='production_verified' AND f.reconciled_at IS NOT NULL
      ORDER BY f.reconciled_at DESC,f.id`).bind(actor.userId).all<ClientReceipt>(),
    readBookingCollections(db, actor, true),
  ]);
  const invoices = issued.results.map(row => {
    const source = object(JSON.parse(row.source_json));
    const bookingId = text(source.bookingId), totalCents = cents(source.totalCents);
    const creditedCents = credits.results.filter(c => c.invoiceId === row.id).reduce((sum, c) => sum + c.amountCents, 0);
    const cleared = receipts.results.filter(r => r.bookingId === bookingId && r.current && r.status === 'cleared_reconciled');
    const receivedCents = cleared.reduce((sum, r) => sum + cents(r.amountCents), 0);
    const refundedCents = cleared.reduce((sum, r) => sum + cents(r.refundedCents), 0);
    const balanceCents = invoiceBalance(totalCents, creditedCents, receivedCents, refundedCents);
    const held = receipts.results.some(r => r.bookingId === bookingId && r.status === 'held');
    const pending = collections.collections.some(c => c.order_id === bookingId && !['prepared', 'approved'].includes(c.state));
    const lines = (Array.isArray(source.lines) ? source.lines : []).map(value => {
      const line = object(value);
      if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0) throw new SignupError('The invoice needs a billing review.', 409);
      return { description: text(line.description), quantity: line.quantity, unitPriceCents: cents(line.unitPriceCents), netCents: cents(line.netCents), taxCents: cents(line.taxCents), grossCents: cents(line.grossCents) };
    });
    return {
      id: row.id, documentId: row.documentId, number: row.number, bookingId, issuedAt: row.issuedAt,
      dueDate: text(source.dueDate) || null, periodStart: text(source.periodStart), periodEnd: text(source.periodEnd),
      currency: 'ZAR' as const, subtotalCents: cents(source.subtotalCents), taxCents: cents(source.taxCents),
      totalCents, creditedCents, receivedCents, refundedCents, balanceCents,
      status: held ? 'Payment under review' : balanceCents < 0 ? 'Credit balance' : balanceCents === 0 ? (receivedCents > refundedCents ? 'Paid' : creditedCents > 0 ? 'Credited' : 'No payment due') : pending ? 'Payment being checked' : 'Payment due',
      lines, issuer: party(source.issuer), client: party(source.client),
    };
  });
  return { invoices, credits: credits.results.filter(c => invoices.some(i => i.id === c.invoiceId)), receipts: receipts.results,
    collections: collections.collections.map(c => ({ reference: c.reference, orderId: c.order_id, amountCents: c.amount_minor, state: c.state, revision: c.revision, current: c.current, checkoutUrl: safeCheckoutUrl(c.checkout_url) })), generatedAt: new Date().toISOString() };
}

export function eftInstructions(runtime: BookingFinanceRuntime, invoice: ClientInvoice): EftInstructions {
  const values = [runtime.LOKD_EFT_BANK_NAME, runtime.LOKD_EFT_ACCOUNT_NAME, runtime.LOKD_EFT_ACCOUNT_NUMBER, runtime.LOKD_EFT_BRANCH_CODE, runtime.LOKD_EFT_ACCOUNT_TYPE];
  if (values.some(v => !v || v.length > 200 || /[\r\n]/.test(v))) throw new SignupError('Bank transfer details are unavailable. Please contact LOKD for payment assistance.', 503);
  if (!/^[0-9]{5,20}$/.test(runtime.LOKD_EFT_ACCOUNT_NUMBER!) || !/^[0-9]{6}$/.test(runtime.LOKD_EFT_BRANCH_CODE!)) throw new SignupError('Bank transfer details need to be checked. Please contact LOKD.', 503);
  if (invoice.balanceCents <= 0) throw new SignupError('This invoice has no payment due.', 409);
  if (invoice.status === 'Payment under review' || invoice.status === 'Payment being checked') throw new SignupError('Your payment is being checked. Please wait before making another payment.', 409);
  return { bank: runtime.LOKD_EFT_BANK_NAME!, accountName: runtime.LOKD_EFT_ACCOUNT_NAME!, accountNumber: runtime.LOKD_EFT_ACCOUNT_NUMBER!, branchCode: runtime.LOKD_EFT_BRANCH_CODE!, accountType: runtime.LOKD_EFT_ACCOUNT_TYPE!, reference: invoice.number, amountCents: invoice.balanceCents, currency: 'ZAR' };
}
export async function operateClientFinance(db: D1Database, actor: SigningActor, input: Record<string, unknown>, headers: Headers, runtime: BookingFinanceRuntime, transport: typeof fetch = fetch) {
  const data = await readClientFinance(db, actor);
  const invoice = data.invoices.find(i => i.id === input.invoiceId);
  if (!invoice) throw new SignupError('Invoice not found for this account.', 404);
  if (input.action === 'eft_instructions') {
    const instructions = eftInstructions(runtime, invoice), now = new Date().toISOString();
    const id = 'EFT-' + crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,'client',?,'eft_instructions_requested','client_invoice',?,?,?)")
        .bind(id, actor.userId, invoice.id, JSON.stringify({ reference: instructions.reference, amountCents: instructions.amountCents }), now),
      clientNotificationStatement(db, { id, sourceId: invoice.id, ownerUserId: actor.userId, recipient: 'client', subject: 'LOKD | Bank transfer details for ' + invoice.number,
        text: `Your LOKD invoice ${invoice.number}\n\nAmount due: ${money(instructions.amountCents)}\nBank: ${instructions.bank}\nAccount name: ${instructions.accountName}\nAccount number: ${instructions.accountNumber}\nBranch code: ${instructions.branchCode}\nAccount type: ${instructions.accountType}\nPayment reference: ${instructions.reference}\n\nUse the exact reference so we can match your payment. Your invoice will update after the funds are received and checked.\n\nLOKD Security`, createdAt: now }),
    ]);
    return { instructions, notificationIds: [id] };
  }
  if (input.action !== 'checkout') throw new SignupError('Choose a supported payment action.');
  if (invoice.balanceCents <= 0 || invoice.status === 'Payment under review') throw new SignupError('This invoice is not available for payment.', 409);
  const collection = data.collections.find(c => c.orderId === invoice.bookingId && c.reference === input.reference);
  if (!collection || !collection.current || collection.amountCents !== invoice.balanceCents) throw new SignupError('The payment amount needs a billing review. Please contact LOKD.', 409);
  await operateBookingCollection(db, actor, { action: 'initialize_collection', reference: collection.reference, revision: input.revision }, headers, runtime, transport);
  const saved = await db.prepare("SELECT checkout_url FROM booking_collection_requests WHERE reference=? AND applicant_id=? AND mode='live' AND state='awaiting_checkout'")
    .bind(collection.reference, actor.userId).first<{ checkout_url: string }>();
  const checkoutUrl = safeCheckoutUrl(saved?.checkout_url);
  if (!checkoutUrl) throw new SignupError('Checkout is being checked. Please refresh your invoice before trying again.', 409);
  return { checkoutUrl, notificationIds: [] };
}

export const money = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount / 100);
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function document(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.5 system-ui;margin:0 auto;max-width:900px;padding:24px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px 6px;border-bottom:1px solid currentColor}dl{display:grid;grid-template-columns:1fr 2fr;gap:8px}dd{margin:0}h1{font-size:28px}@media print{body{padding:0}}</style></head><body><p>LOKD Security</p><h1>${escape(title)}</h1>${body}</body></html>`;
}
export function renderClientFinance(data: BookingFinanceData, kind: string, id?: string) {
  if (kind === 'statement') {
    const balance = data.invoices.reduce((sum, invoice) => sum + invoice.balanceCents, 0);
    return document('Your statement', `<p>As at ${escape(data.generatedAt)}</p><table><thead><tr><th>Invoice</th><th>Due</th><th>Total</th><th>Credits</th><th>Received</th><th>Refunded</th><th>Balance</th></tr></thead><tbody>${data.invoices.map(i => `<tr><td>${escape(i.number)}</td><td>${escape(i.dueDate)}</td><td>${escape(money(i.totalCents))}</td><td>${escape(money(i.creditedCents))}</td><td>${escape(money(i.receivedCents))}</td><td>${escape(money(i.refundedCents))}</td><td>${escape(money(i.balanceCents))}</td></tr>`).join('')}</tbody></table><p>Account balance: <strong>${escape(money(balance))}</strong></p>`);
  }
  if (kind === 'invoice') {
    const i = data.invoices.find(row => row.id === id);
    if (!i) throw new SignupError('Invoice not found for this account.', 404);
    return document('Invoice ' + i.number, `<p>Issued ${escape(i.issuedAt)} · ${escape(i.status)}</p><h2>${escape(i.issuer.legalName)}</h2><p>${escape(i.issuer.address)}</p><p>${i.issuer.vatNumber ? 'VAT: ' + escape(i.issuer.vatNumber) : ''}</p><h2>Bill to ${escape(i.client.legalName)}</h2><p>${escape(i.client.address)}</p><p>Service: ${escape(i.periodStart)} to ${escape(i.periodEnd)} · Booking ${escape(i.bookingId)}</p><table><thead><tr><th>Service</th><th>Quantity</th><th>Unit price</th><th>Tax</th><th>Total</th></tr></thead><tbody>${i.lines.map(l => `<tr><td>${escape(l.description)}</td><td>${l.quantity}</td><td>${escape(money(l.unitPriceCents))}</td><td>${escape(money(l.taxCents))}</td><td>${escape(money(l.grossCents))}</td></tr>`).join('')}</tbody></table><dl><dt>Subtotal</dt><dd>${escape(money(i.subtotalCents))}</dd><dt>Tax</dt><dd>${escape(money(i.taxCents))}</dd><dt>Total</dt><dd>${escape(money(i.totalCents))}</dd><dt>Balance due</dt><dd>${escape(money(i.balanceCents))}</dd><dt>Due date</dt><dd>${escape(i.dueDate)}</dd></dl>`);
  }
  if (kind === 'credit') {
    const c = data.credits.find(row => row.id === id), i = data.invoices.find(row => row.id === c?.invoiceId);
    if (!c || !i) throw new SignupError('Credit note not found for this account.', 404);
    return document('Credit note ' + c.number, `<p>Issued ${escape(c.issuedAt)}</p><h2>${escape(i.issuer.legalName)}</h2><p>${escape(i.issuer.address)}</p><p>${i.issuer.vatNumber ? 'VAT: ' + escape(i.issuer.vatNumber) : ''}</p><h2>${escape(i.client.legalName)}</h2><p>${escape(i.client.address)}</p><p>Invoice ${escape(i.number)}</p><p>${escape(c.reason)}</p><dl><dt>Net credit</dt><dd>${escape(money(c.netCents))}</dd><dt>Tax credit</dt><dd>${escape(money(c.taxCents))}</dd><dt>Total credit</dt><dd>${escape(money(c.amountCents))}</dd></dl>`);
  }
  if (kind === 'receipt') {
    const r = data.receipts.find(row => row.id === id);
    if (!r) throw new SignupError('Receipt not found for this account.', 404);
    return document('Payment receipt', `<dl><dt>Receipt</dt><dd>${escape(r.id)}</dd><dt>Booking</dt><dd>${escape(r.bookingId)}</dd><dt>Payment reference</dt><dd>${escape(r.reference)}</dd><dt>Received</dt><dd>${escape(r.receivedAt)}</dd><dt>Amount</dt><dd>${escape(money(r.amountCents))}</dd><dt>Refunded</dt><dd>${escape(money(r.refundedCents))}</dd><dt>Status</dt><dd>${escape(r.status.replaceAll('_', ' '))}</dd></dl>`);
  }
  throw new SignupError('Choose an invoice, statement, credit note or receipt.');
}
