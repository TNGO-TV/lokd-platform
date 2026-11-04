import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { env } from 'cloudflare:workers';
import { readFileSync } from 'node:fs';
import { readClientFinance, renderClientFinance, invoiceBalance, eftInstructions, safeCheckoutUrl, operateClientFinance } from '../app/lib/booking-finance.ts';
import { collectionKey } from '../app/lib/booking-collections.ts';
import { GET, POST } from '../app/api/client-finance/route.ts';

const actor = { userId: 'customer-one', email: 'customer@example.test', operations: false, owner: false };
function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE finance_document_versions(id TEXT,source_id TEXT,source_json TEXT,party_id TEXT,recipient_user TEXT,kind TEXT,version INTEGER);
    CREATE TABLE finance_document_issues(document_id TEXT,number TEXT,issued_at TEXT);
    CREATE TABLE client_invoices(id TEXT,client_id TEXT,environment TEXT,integrity_state TEXT);
    CREATE TABLE production_entity_links(kind TEXT,entity_id TEXT,owner_user_id TEXT);
    CREATE TABLE credit_notes(id TEXT,invoice_id TEXT,direction INTEGER,net_cents INTEGER,tax_cents INTEGER,payload_json TEXT);
    CREATE TABLE credit_note_issues(credit_id TEXT,number TEXT,issued_at TEXT);
    CREATE TABLE booking_funding_reconciliations(id TEXT,booking_id TEXT,provider_reference TEXT,provider TEXT,reconciled_at TEXT,cleared_at TEXT,cleared_amount_cents INTEGER,status TEXT,active_key TEXT,environment TEXT,integrity_state TEXT);
    CREATE TABLE bookings(id TEXT,client_id TEXT,environment TEXT,integrity_state TEXT);
    CREATE TABLE booking_refund_receipts(id TEXT,case_id TEXT,bank_amount_minor INTEGER);
    CREATE TABLE booking_refund_receipt_decisions(receipt_id TEXT,decision TEXT);
    CREATE TABLE booking_refund_cases(id TEXT,reference TEXT);
    CREATE TABLE booking_collection_requests(reference TEXT,mode TEXT,applicant_id TEXT,client_id TEXT,created_at TEXT);
    CREATE TABLE audit_events(id TEXT,actor_type TEXT,actor_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,detail TEXT,created_at TEXT);
    CREATE TABLE client_notification_jobs(id TEXT PRIMARY KEY,source_id TEXT,owner_user_id TEXT,recipient_type TEXT,subject TEXT,message_text TEXT,next_attempt_at TEXT,created_at TEXT,updated_at TEXT);
  `);
  const source = owner => ({ bookingId: 'booking-' + owner, currency: 'ZAR', subtotalCents: 10000, taxCents: 0, totalCents: 10000, dueDate: '2026-11-10', periodStart: '2026-11-05', periodEnd: '2026-11-06', issuer: { legalName: 'LOKD Security' }, client: { legalName: owner === actor.userId ? 'Customer <script>' : 'OTHER CUSTOMER SECRET' }, lines: [{ description: 'Guarding', quantity: 1, unitPriceCents: 10000, netCents: 10000, taxCents: 0, grossCents: 10000 }] });
  for (const owner of [actor.userId, 'customer-two']) {
    database.prepare("INSERT INTO production_entity_links VALUES('client',?,?)").run('client-' + owner, owner);
    database.prepare("INSERT INTO client_invoices VALUES(?,?,'production','production_verified')").run('invoice-' + owner, 'client-' + owner);
    database.prepare("INSERT INTO bookings VALUES(?,?,'production','production_verified')").run('booking-' + owner, 'client-' + owner);
    database.prepare("INSERT INTO finance_document_versions VALUES(?,?,?,?,?,'invoice',1)").run('document-' + owner, 'invoice-' + owner, JSON.stringify(source(owner)), 'client-' + owner, owner);
    database.prepare('INSERT INTO finance_document_issues VALUES(?,?,?)').run('document-' + owner, 'LOKD-' + owner, '2026-11-04T10:00:00Z');
  }
  const db = { prepare(sql) {
    const make = values => ({ bind: (...v) => make(v), first: async () => database.prepare(sql).get(...values) ?? null, all: async () => ({ results: database.prepare(sql).all(...values) }), run: async () => ({ meta: database.prepare(sql).run(...values) }) });
    return make([]);
  }, async batch(statements) { database.exec('BEGIN'); try { const result = []; for (const s of statements) result.push(await s.run()); database.exec('COMMIT'); return result; } catch (e) { database.exec('ROLLBACK'); throw e; } } };
  return { database, db, close: () => database.close() };
}

test('issued invoices, documents and balances are bound to the current client owner', async () => {
  const f = fixture();
  try {
    const data = await readClientFinance(f.db, actor);
    assert.equal(data.invoices.length, 1);
    assert.equal(data.invoices[0].balanceCents, 10000);
    assert.equal(JSON.stringify(data).includes('OTHER CUSTOMER SECRET'), false);
    assert.throws(() => renderClientFinance(data, 'invoice', 'invoice-customer-two'), e => e.status === 404);
    const html = renderClientFinance(data, 'invoice', 'invoice-' + actor.userId);
    assert.ok(html.includes('Customer &lt;script&gt;'));
    assert.equal(html.includes('<script>'), false);
    f.database.prepare('UPDATE production_entity_links SET owner_user_id=? WHERE entity_id=?').run('replacement-owner', 'client-' + actor.userId);
    assert.equal((await readClientFinance(f.db, actor)).invoices.length, 0);
  } finally { f.close(); }
});

test('issued credits and reconciled refunds adjust a fully received invoice without losing money', async () => {
  const f = fixture();
  try {
    f.database.prepare('INSERT INTO credit_notes VALUES(?,?,1,2000,0,?)').run('credit', 'invoice-' + actor.userId, JSON.stringify({ note: 'Reduced cover' }));
    f.database.exec("INSERT INTO credit_note_issues VALUES('credit','CN-1','2026-11-04T11:00:00Z')");
    f.database.prepare("INSERT INTO booking_funding_reconciliations VALUES('receipt',?,'payment','eft','2026-11-04T12:00:00Z','2026-11-04T12:00:00Z',10000,'cleared_reconciled',?,'production','production_verified')").run('booking-' + actor.userId, 'booking-' + actor.userId);
    f.database.exec("INSERT INTO booking_refund_cases VALUES('refund','payment'); INSERT INTO booking_refund_receipts VALUES('refund-receipt','refund',2000); INSERT INTO booking_refund_receipt_decisions VALUES('refund-receipt','approved')");
    const data = await readClientFinance(f.db, actor), invoice = data.invoices[0];
    assert.deepEqual([invoice.creditedCents, invoice.receivedCents, invoice.refundedCents, invoice.balanceCents], [2000, 10000, 2000, 0]);
    assert.equal(invoice.status, 'Paid');
    assert.equal(data.receipts[0].refundedCents, 2000);
    assert.ok(renderClientFinance(data, 'credit', 'credit').includes('Reduced cover'));
    assert.ok(renderClientFinance(data, 'receipt', 'receipt').includes('Payment receipt'));
    assert.throws(() => eftInstructions({}, invoice), e => e.status === 503);
  } finally { f.close(); }
});

test('EFT instructions require configured bank details and atomically record request and email', async () => {
  const f = fixture();
  try {
    const runtime = { LOKD_EFT_BANK_NAME: 'Local fixture bank', LOKD_EFT_ACCOUNT_NAME: 'Local fixture account', LOKD_EFT_ACCOUNT_NUMBER: '12345678', LOKD_EFT_BRANCH_CODE: '123456', LOKD_EFT_ACCOUNT_TYPE: 'Current' };
    await assert.rejects(() => operateClientFinance(f.db, actor, { action: 'eft_instructions', invoiceId: 'invoice-' + actor.userId }, new Headers(), {}), e => e.status === 503);
    assert.equal(f.database.prepare('SELECT count(*) AS n FROM audit_events').get().n, 0);
    const result = await operateClientFinance(f.db, actor, { action: 'eft_instructions', invoiceId: 'invoice-' + actor.userId }, new Headers(), runtime);
    assert.equal(result.instructions.reference, 'LOKD-' + actor.userId);
    assert.equal(result.instructions.amountCents, 10000);
    assert.equal(f.database.prepare('SELECT count(*) AS n FROM audit_events').get().n, 1);
    const job = f.database.prepare('SELECT * FROM client_notification_jobs').get();
    assert.equal(job.owner_user_id, actor.userId);
    assert.ok(job.message_text.includes(result.instructions.reference));
    assert.ok(job.message_text.includes('12345678'));
    await assert.rejects(() => operateClientFinance(f.db, actor, { action: 'eft_instructions', invoiceId: 'invoice-customer-two' }, new Headers(), runtime), e => e.status === 404);
  } finally { f.close(); }
});

test('money, checkout destination and provider configuration reject invalid inputs locally', () => {
  assert.equal(invoiceBalance(10000, 2000, 10000, 2000), 0);
  assert.equal(invoiceBalance(10000, 0, 11000, 0), -1000);
  for (const args of [[100, 0, 100, 101], [100, 0, 0.5, 0], [100, 0, -10, 0], [Number.MAX_SAFE_INTEGER, -100, 0, 0]]) assert.throws(() => invoiceBalance(...args));
  assert.equal(safeCheckoutUrl('https://checkout.paystack.com/reference'), 'https://checkout.paystack.com/reference');
  for (const url of ['https://checkout.paystack.com.evil.invalid/', 'javascript:alert(1)', 'https://user@checkout.paystack.com/', 'https://checkout.paystack.com/#secret', 'http://checkout.paystack.com/']) assert.equal(safeCheckoutUrl(url), null);
  assert.throws(() => collectionKey({}, 'live'), e => e.status === 503);
  assert.throws(() => collectionKey({}, 'other'), e => e.status === 422);
});

test('billing route denies anonymous access, cross-origin writes and another client document', async () => {
  const f = fixture(), oldDb = env.DB; env.DB = f.db;
  try {
    assert.equal((await GET(new Request('https://client.lokd.co.za/api/client-finance'))).status, 401);
    const headers = { 'x-lokd-verified-user-id': actor.userId, 'x-lokd-verified-email': actor.email };
    const foreign = await GET(new Request('https://client.lokd.co.za/api/client-finance?download=invoice&id=invoice-customer-two', { headers }));
    assert.equal(foreign.status, 404); assert.equal(foreign.headers.get('cache-control'), 'private, no-store');
    assert.equal((await POST(new Request('https://client.lokd.co.za/api/client-finance', { method: 'POST', headers: { ...headers, origin: 'https://other.invalid', 'content-type': 'application/json' }, body: '{}' }))).status, 403);
  } finally { env.DB = oldDb; f.close(); }
});

test('D1 checkout claim rejects changed credit, received funds and unaccepted quote atomically', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE booking_collection_requests(reference TEXT,order_id TEXT,client_id TEXT,applicant_id TEXT,amount_minor INTEGER,currency TEXT,mode TEXT,state TEXT,prepared_by TEXT,created_at TEXT);
      CREATE TABLE audit_events(id TEXT,actor_type TEXT,actor_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,detail TEXT,created_at TEXT);
      CREATE TABLE client_invoices(id TEXT,booking_id TEXT,client_id TEXT,environment TEXT,integrity_state TEXT,total_cents INTEGER);
      CREATE TABLE finance_document_versions(id TEXT,kind TEXT,source_id TEXT,recipient_user TEXT,source_json TEXT,version INTEGER);
      CREATE TABLE finance_document_issues(document_id TEXT);
      CREATE TABLE credit_notes(id TEXT,invoice_id TEXT,direction INTEGER,net_cents INTEGER,tax_cents INTEGER);
      CREATE TABLE credit_note_issues(credit_id TEXT);
      CREATE TABLE booking_funding_reconciliations(id TEXT,booking_id TEXT,environment TEXT,active_key TEXT,status TEXT);
      CREATE TABLE client_quote_offers(id TEXT,order_id TEXT,owner_user_id TEXT,source_json TEXT,sequence INTEGER,terms_id TEXT);
      CREATE TABLE client_quote_receipts(quote_id TEXT,actor_id TEXT);
      CREATE TABLE client_quote_sources(order_id TEXT,source_json TEXT);
      CREATE TABLE client_quote_cancellations(quote_id TEXT);
      CREATE TABLE client_terms_withdrawals(terms_id TEXT);
    `);
    db.exec(readFileSync(new URL('../drizzle/0128_client_live_collections.sql', import.meta.url), 'utf8'));
    assert.throws(() => db.prepare('INSERT INTO booking_collection_requests VALUES(?,?,?,?,?,?,?,?,?,?)').run('rejected', 'order', 'client', actor.userId, 10000, 'ZAR', 'other', 'prepared', 'operator', '2026-11-04'), /Live collection required/);
    db.prepare("INSERT INTO booking_collection_requests VALUES('payment','order','client',?,10000,'ZAR','live','approved','operator','2026-11-04')").run(actor.userId);
    assert.equal(db.prepare('SELECT count(*) AS n FROM audit_events').get().n, 1);
    db.exec("INSERT INTO client_invoices VALUES('invoice','order','client','production','production_verified',10000)");
    db.prepare("INSERT INTO finance_document_versions VALUES('document','invoice','invoice',?,'{\"totalCents\":10000}',1)").run(actor.userId);
    db.exec("INSERT INTO finance_document_issues VALUES('document'); INSERT INTO client_quote_sources VALUES('order','{}')");
    db.prepare("INSERT INTO client_quote_offers VALUES('quote','order',?,'{}',1,'terms')").run(actor.userId);
    const claim = () => db.exec("UPDATE booking_collection_requests SET state='initializing' WHERE reference='payment'");
    assert.throws(claim, /Accept the current quote/);
    db.prepare("INSERT INTO client_quote_receipts VALUES('quote',?)").run(actor.userId);
    claim();
    db.exec("UPDATE booking_collection_requests SET state='approved'; INSERT INTO credit_notes VALUES('credit','invoice',1,1000,0); INSERT INTO credit_note_issues VALUES('credit')");
    assert.throws(claim, /Invoice amount changed/);
    assert.equal(db.prepare('SELECT state FROM booking_collection_requests').get().state, 'approved');
    db.exec("DELETE FROM credit_note_issues; INSERT INTO booking_funding_reconciliations VALUES('funding','order','production','order','cleared_reconciled')");
    assert.throws(claim, /payment already received/);
    db.exec("DELETE FROM booking_funding_reconciliations; INSERT INTO client_terms_withdrawals VALUES('terms')");
    assert.throws(claim, /Accept the current quote/);
  } finally { db.close(); }
});
