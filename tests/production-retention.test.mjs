import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runDataRetention } from '../app/lib/platform-jobs.ts';

const root=new URL('../',import.meta.url);
function migrated(before=9999){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync(new URL('drizzle/',root)).filter(f=>f.endsWith('.sql')).sort())if(Number(file.slice(0,4))<before)sql.exec(fs.readFileSync(new URL('drizzle/'+file,root),'utf8'));return sql;}
function adapter(sql){return {prepare(query){const stmt={values:[],bind(...v){return {...stmt,values:v};},run(){return {meta:{changes:sql.prepare(query).run(...this.values).changes}};}};return stmt;},async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};}
function enquiry(sql,id,created,deadline,organisation='Real enquiry'){
 sql.prepare(`INSERT INTO client_enquiries(id,organisation_name,contact_name,email_normalized,site_area,site_type,required_start,message,privacy_notice_version,privacy_acknowledged_at,retention_review_at,created_at,updated_at) VALUES(?,?, 'Contact','owner@example.test','Sandton','commercial_property','planning','Enquiry for security services','privacy-v1',?,?,?,?)`).run(id,organisation,created,deadline,created,created);
 sql.prepare('INSERT INTO client_enquiry_receipts VALUES(?,?,?,?)').run('key:'+id,'hash:'+id,id,created);
}

test('retention removes expired unlinked intake and receipts atomically, preserving current and linked intake',async()=>{
 const sql=migrated();try{
  enquiry(sql,'expired','2020-01-01T00:00:00.000Z','2021-01-01T00:00:00.000Z');
  enquiry(sql,'current','2026-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z');
  enquiry(sql,'active-delivery','2020-01-01T00:00:00.000Z','2021-01-01T00:00:00.000Z');
  enquiry(sql,'linked','2020-01-01T00:00:00.000Z','2021-01-01T00:00:00.000Z');
  sql.prepare("INSERT INTO signup_cases VALUES('client','linked','owner','reviewed','Approved','{}',1,'link','2020-01-01T00:00:00.000Z')").run();
  sql.prepare("UPDATE operational_delivery_jobs SET state='dispatching' WHERE source_id='active-delivery'").run();
  assert.throws(()=>sql.prepare("DELETE FROM client_enquiries WHERE id='current'").run(),/history_required/);
  assert.throws(()=>sql.prepare("DELETE FROM client_enquiry_receipts WHERE enquiry_id='current'").run(),/history_required/);
  const first=await runDataRetention(adapter(sql));assert.equal(first.enquiries,1);
  assert.deepEqual(sql.prepare('SELECT id FROM client_enquiries ORDER BY id').all().map(r=>r.id),['active-delivery','current','linked']);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM operational_delivery_jobs WHERE source_id='expired'").get().n,0);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM client_enquiry_receipts WHERE enquiry_id='expired'").get().n,0);
  assert.equal((await runDataRetention(adapter(sql))).enquiries,0);
  assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{sql.close();}
});

test('application receipt retention advances past already-cleared applications',async()=>{
 const sql=migrated();try{
  const insert=sql.prepare(`INSERT INTO officer_applications(id,pathway,full_name,mobile_normalized,email_normalized,city,province,psira_status,service_interests,training_interests,over_18_confirmed,eligibility_acknowledged,privacy_notice_version,privacy_acknowledged_at,retention_review_at,created_at,updated_at) VALUES(?,'qualified','Local fixture',?,'owner@example.test','Sandton','Gauteng','registered','[]','[]',1,1,'privacy-v1','2020-01-01','2021-01-01','2020-01-01','2020-01-01')`);
  for(let n=0;n<102;n++)insert.run('application-'+n,'+2782'+String(n).padStart(7,'0'));
  for(let n=100;n<102;n++)sql.prepare('INSERT INTO officer_application_receipts VALUES(?,?,?,?)').run('key-'+n,'hash-'+n,'application-'+n,'2020-01-01');
  sql.prepare("INSERT INTO signup_cases VALUES('officer','application-101','owner','reviewed','Approved','{}',1,'link','2020-01-01')").run();
  assert.equal((await runDataRetention(adapter(sql))).applicationReceipts,1);
  assert.deepEqual(sql.prepare('SELECT application_id FROM officer_application_receipts').all().map(r=>r.application_id),['application-101']);
  assert.equal((await runDataRetention(adapter(sql))).applicationReceipts,0);
 }finally{sql.close();}
});

test('cleanup targets exact confirmed enquiries, is idempotent and leaves a similar real enquiry',()=>{
 const sql=migrated(170);try{
  enquiry(sql,'ENQ-E8E621DB','2026-09-27T00:14:26.046Z','2027-09-27T00:14:26.046Z','LOKD SYNTHETIC ZEPTOMAIL ALLOWLIST TEST NOT A CUSTOMER 20260927001425');
  enquiry(sql,'ENQ-4FF55726','2026-09-27T01:04:48.761Z','2027-09-27T01:04:48.761Z','SYNTHETIC SMTP WORKER PATH 1790471088 — NOT A CUSTOMER');
  enquiry(sql,'real','2026-09-27T00:14:26.046Z','2027-09-27T00:14:26.046Z');
  const cleanup=fs.readFileSync(new URL('drizzle/0170_remove_recorded_nonproduction_data.sql',root),'utf8');
  sql.exec(cleanup);sql.exec(cleanup);
  assert.deepEqual(sql.prepare('SELECT id FROM client_enquiries').all().map(r=>r.id),['real']);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM client_enquiry_receipts').get().n,1);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM operational_delivery_jobs').get().n,2);
  assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{sql.close();}
});
