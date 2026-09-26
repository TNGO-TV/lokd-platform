import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {lokdInvoicePublicNumber,lokdQuoteMonthKey,lokdQuotePublicNumber} from '../app/lib/lokd-numbering.ts';

const septemberStart=new Date('2026-09-01T00:00:00+02:00');
const septemberEnd=new Date('2026-09-30T21:59:59.999Z');
const octoberStart=new Date('2026-09-30T22:00:00.000Z');

function numberingDatabase(withLegacyRows=false){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE client_quote_offers (
  id text PRIMARY KEY NOT NULL,
  order_id text NOT NULL,
  owner_user_id text NOT NULL,
  terms_id text NOT NULL,
  source_json text NOT NULL,
  source_hash text NOT NULL,
  offer_hash text NOT NULL,
  issued_by text NOT NULL,
  issued_at text NOT NULL,
  expires_at text NOT NULL,
  sequence integer NOT NULL,
  case_version integer NOT NULL
 )`);
 if(withLegacyRows){
  const insert=db.prepare('INSERT INTO client_quote_offers VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  insert.run('QUOTE-legacy-a','order-a','owner','terms','{}','hash','offer','issuer','2026-08-01T00:00:00.000Z','2030-01-01T00:00:00.000Z',1,1);
  insert.run('QUOTE-legacy-b','order-b','owner','terms','{}','hash','offer','issuer','2026-08-02T00:00:00.000Z','2030-01-01T00:00:00.000Z',1,1);
 }
 db.exec(fs.readFileSync(new URL('../drizzle/0080_lokd_quote_public_numbers.sql',import.meta.url),'utf8'));
 return db;
}
function issue(db,id,issuedAt,sequence,orderId){
 const monthKey=lokdQuoteMonthKey(issuedAt);
 db.prepare(`INSERT INTO client_quote_offer_issues(id,order_id,owner_user_id,terms_id,source_json,source_hash,offer_hash,issued_by,issued_at,expires_at,sequence,case_version,month_key)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,orderId,'owner','terms','{}','hash','offer','issuer',issuedAt.toISOString(),'2030-01-01T00:00:00.000Z',sequence,1,monthKey);
 return db.prepare('SELECT public_number FROM client_quote_offers WHERE id=?').get(id).public_number;
}

test('public numbers restart each SAST month and invoices use the INV- prefix',()=>{
 assert.equal(lokdQuoteMonthKey(septemberStart),'2609');
 assert.equal(lokdQuoteMonthKey(septemberEnd),'2609');
 assert.equal(lokdQuoteMonthKey(octoberStart),'2610');
 assert.equal(lokdQuoteMonthKey(new Date('2025-12-31T21:59:59.999Z')),'2512');
 assert.equal(lokdQuoteMonthKey(new Date('2025-12-31T22:00:00.000Z')),'2601');
 assert.equal(lokdQuotePublicNumber('2609',1),'LOKD260901');
 assert.equal(lokdQuotePublicNumber('2609',2),'LOKD260902');
 assert.equal(lokdQuotePublicNumber('2610',1),'LOKD261001');
 assert.equal(lokdInvoicePublicNumber('LOKD260901'),'INV-LOKD260901');
 assert.equal(lokdInvoicePublicNumber('LOKD261001'),'INV-LOKD261001');
 assert.throws(()=>lokdQuotePublicNumber('2609',0),/quote_month_sequence_exhausted/);
 assert.throws(()=>lokdQuotePublicNumber('2609',100),/quote_month_sequence_exhausted/);
 assert.throws(()=>lokdInvoicePublicNumber('QUOTE-1'),/quote_public_number_required/);
 assert.throws(()=>lokdInvoicePublicNumber('INV-LOKD260901'),/quote_public_number_required/);
});

test('the monthly counter is global, unique, and rolls back when the quote insert is rejected',()=>{
 const db=numberingDatabase(true);
 assert.equal(db.prepare('SELECT public_number FROM client_quote_offers WHERE id=?').get('QUOTE-legacy-a').public_number,null);
 assert.equal(db.prepare('SELECT public_number FROM client_quote_offers WHERE id=?').get('QUOTE-legacy-b').public_number,null);
 assert.equal(issue(db,'QUOTE-sep-1',septemberStart,1,'order-1'),'LOKD260901');
 assert.equal(issue(db,'QUOTE-sep-2',septemberEnd,1,'order-2'),'LOKD260902');
 assert.equal(issue(db,'QUOTE-oct-1',octoberStart,1,'order-3'),'LOKD261001');
 assert.equal(db.prepare('SELECT COUNT(DISTINCT public_number) AS n FROM client_quote_offers WHERE public_number IS NOT NULL').get().n,3);
 assert.throws(()=>db.prepare(`INSERT INTO client_quote_offers(id,order_id,owner_user_id,terms_id,source_json,source_hash,offer_hash,issued_by,issued_at,expires_at,sequence,case_version,public_number)
  VALUES('QUOTE-dup','order-9','owner','terms','{}','hash','offer','issuer',?,'2030-01-01T00:00:00.000Z',1,1,'LOKD260902')`).run(septemberEnd.toISOString()),/UNIQUE constraint failed: client_quote_offers.public_number/);
 const before=db.prepare('SELECT last_sequence FROM lokd_quote_month_counters WHERE month_key=?').get('2610').last_sequence;
 assert.throws(()=>db.prepare(`INSERT INTO client_quote_offer_issues(id,order_id,owner_user_id,terms_id,source_json,source_hash,offer_hash,issued_by,issued_at,expires_at,sequence,case_version,month_key)
  VALUES('QUOTE-mismatch','order-9','owner','terms','{}','hash','offer','issuer',?,'2030-01-01T00:00:00.000Z',1,1,'2610')`).run(septemberStart.toISOString()),/quote_public_number_required/);
 assert.equal(db.prepare('SELECT last_sequence FROM lokd_quote_month_counters WHERE month_key=?').get('2610').last_sequence,before);
 assert.equal(db.prepare('SELECT id FROM client_quote_offers WHERE id=?').get('QUOTE-mismatch'),undefined);
 for(let sequence=2;sequence<=99;sequence++)issue(db,'QUOTE-oct-'+sequence,octoberStart,sequence,'order-oct-'+sequence);
 assert.equal(db.prepare('SELECT public_number FROM client_quote_offers WHERE id=?').get('QUOTE-oct-99').public_number,'LOKD261099');
 assert.throws(()=>issue(db,'QUOTE-oct-100',octoberStart,100,'order-oct-100'),/quote_month_sequence_exhausted/);
 assert.equal(db.prepare('SELECT last_sequence FROM lokd_quote_month_counters WHERE month_key=?').get('2610').last_sequence,99);
 assert.equal(db.prepare('SELECT id FROM client_quote_offers WHERE id=?').get('QUOTE-oct-100'),undefined);
 db.close();
});
