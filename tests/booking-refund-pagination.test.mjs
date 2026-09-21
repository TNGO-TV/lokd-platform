import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {readBookingRefunds} from '../app/lib/booking-refunds.ts';
import {GET} from '../app/api/booking-refunds/route.ts';
const actor={userId:'page-user',email:'page@example.test',operations:true,owner:false};
const headers=()=>new Headers({'x-lokd-verified-user-id':actor.userId,'x-lokd-verified-email':actor.email,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()});
const keys={sources:'sources',cases:'refundCases',receipts:'refundReceipts',observations:'refundObservations',states:'refundStates'};
function fixture(){
 const database=new DatabaseSync(':memory:');let afterAll;
 // Deliberately minimal read models: pagination must not mutate or call providers.
 database.exec(`CREATE TABLE operator_accounts(id TEXT,email TEXT,status TEXT,environment TEXT,integrity_state TEXT,approval_limit_cents INTEGER);
 INSERT INTO operator_accounts VALUES('op','page@example.test','active','production','production_verified',1000);
 CREATE TABLE operator_role_assignments(operator_id TEXT,role TEXT,status TEXT,environment TEXT,integrity_state TEXT);
 INSERT INTO operator_role_assignments VALUES('op','funding_reconciler','active','production','production_verified');
 CREATE TABLE booking_refund_sources(reference TEXT PRIMARY KEY,provider_id TEXT,amount_minor INTEGER,applicant_id TEXT,source_json TEXT);
 CREATE TABLE booking_refund_cases(id TEXT PRIMARY KEY,reference TEXT,payload_json TEXT);
 CREATE TABLE booking_refund_decisions(case_id TEXT,decision TEXT);
 CREATE TABLE booking_refund_claims(case_id TEXT,id TEXT);
 CREATE TABLE booking_refund_authorized(id TEXT);
 CREATE TABLE booking_refund_receipts(id TEXT PRIMARY KEY,case_id TEXT,payload_json TEXT);
 CREATE TABLE booking_refund_receipt_decisions(receipt_id TEXT,decision TEXT);
 CREATE TABLE booking_refund_observations(id TEXT PRIMARY KEY,case_id TEXT,evidence_json TEXT);
 CREATE TABLE booking_refund_state(reference TEXT PRIMARY KEY,state TEXT);
 CREATE TABLE payment_live_control(id INTEGER,enabled INTEGER);INSERT INTO payment_live_control VALUES(1,0);
 CREATE TABLE booking_refund_control(id INTEGER,enabled INTEGER);INSERT INTO booking_refund_control VALUES(1,0);`);
 const insert=(ref,amount,user)=>{database.prepare('INSERT INTO booking_refund_sources VALUES(?,?,?,?,?)').run(ref,'provider',amount,user,'{}');database.prepare('INSERT INTO booking_refund_cases VALUES(?,?,?)').run('case-'+ref,ref,'{}');database.prepare('INSERT INTO booking_refund_receipts VALUES(?,?,?)').run('receipt-'+ref,'case-'+ref,'{}');database.prepare('INSERT INTO booking_refund_observations VALUES(?,?,?)').run('observation-'+ref,'case-'+ref,'{}');database.prepare('INSERT INTO booking_refund_state VALUES(?,?)').run(ref,'held');};
 for(let i=0;i<620;i++)insert('allowed-'+String(i).padStart(4,'0'),100,'other-user');
 // Hidden rows deliberately sort before sources and after visible rowids. They
 // must not consume a page, expose counts or prevent older visible rows loading.
 for(let i=0;i<700;i++)insert('000-hidden-'+String(i).padStart(4,'0'),i%2?2000:100,i%2?'other-user':actor.userId);
 const queries=[];
 const db={prepare(sql){queries.push(sql);const make=values=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>{const results=database.prepare(sql).all(...values);afterAll?.(sql);return {results};}});return make([]);}};
 return {db,database,queries,insert,afterAll(fn){afterAll=fn;},close:()=>database.close()};
}
for(const dataset of Object.keys(keys))test('refund '+dataset+' keyset pages expose every authorized row beyond old caps',async()=>{
 const f=fixture();try{
  let cursor;const found=[];
  do{
   const result=await readBookingRefunds(f.db,actor,headers(),{}, {dataset,pageSize:37,...(cursor?{cursor}:{})});
   const rows=result[keys[dataset]];assert.equal(rows.some(row=>JSON.stringify(row).includes('hidden')),false);assert.ok(rows.length<=37);
   assert.equal(Object.keys(result.pagination).length,1);assert.equal('total' in result.pagination[dataset],false);
   for(const row of rows){assert.equal('__page_key' in row,false);found.push(row.reference??row.id);}
   cursor=result.pagination[dataset].nextCursor;assert.equal(result.pagination[dataset].hasMore,cursor!==null);
  }while(cursor);
  assert.equal(found.length,620);assert.equal(new Set(found).size,620);
  const sorted=[...found].sort();assert.deepEqual(found,dataset==='sources'||dataset==='states'?sorted:sorted.reverse());
  assert.ok(f.queries.filter(q=>q.includes('__page_key')).every(q=>q.includes(' LIMIT ?')&&q.includes('actor.approval_limit_cents>=s.amount_minor')));
 }finally{f.close();}
});
test('independent cursors, concurrent insertion, exact reference lookup and cursor validation',async()=>{
 const f=fixture();try{
  const first=await readBookingRefunds(f.db,actor,headers(),{}, {pageSize:5});
  for(const key of Object.values(keys))assert.equal(first[key].length,5);
  const selected=await readBookingRefunds(f.db,actor,headers(),{}, {dataset:'sources',reference:'allowed-0619'});assert.equal(selected.sources.length,1);assert.equal(selected.sources[0].reference,'allowed-0619');
  const exact=await readBookingRefunds(f.db,actor,headers(),{}, {caseId:'case-allowed-0619'});for(const key of Object.values(keys))assert.equal(exact[key].length,1);assert.equal(exact.refundCases[0].id,'case-allowed-0619');
  const absent=await readBookingRefunds(f.db,actor,headers(),{}, {caseId:'unknown'});for(const key of Object.values(keys))assert.equal(absent[key].length,0);
  const hidden=await readBookingRefunds(f.db,actor,headers(),{}, {dataset:'sources',reference:'000-hidden-0001'});assert.deepEqual(hidden.sources,[]);assert.deepEqual(hidden.pagination.sources,{hasMore:false,nextCursor:null});
  f.insert('allowed-new',100,'other-user');
  const next=await readBookingRefunds(f.db,actor,headers(),{}, {dataset:'cases',pageSize:5,cursor:first.pagination.cases.nextCursor});
  assert.ok(next.refundCases.every(row=>!first.refundCases.some(old=>old.id===row.id)));assert.ok(next.refundCases.every(row=>row.reference!=='allowed-new'));
  const multi=await readBookingRefunds(f.db,actor,headers(),{}, {pageSize:5,cursors:{sources:first.pagination.sources.nextCursor,cases:first.pagination.cases.nextCursor}});assert.equal(multi.sources[0].reference,'allowed-0005');
  for(const options of [{dataset:'cases',cursor:first.pagination.sources.nextCursor},{dataset:'sources',cursor:'garbage'},{dataset:'sources',cursor:''},{dataset:'sources',cursor:first.pagination.sources.nextCursor,reference:'allowed-0000'},{cursor:first.pagination.sources.nextCursor},{pageSize:101},{pageSize:0},{dataset:'invalid'}])await assert.rejects(()=>readBookingRefunds(f.db,actor,headers(),{},options),e=>e.status===400);
  await assert.rejects(()=>readBookingRefunds(f.db,{...actor,userId:'other-operator'},headers(),{}, {dataset:'sources',cursor:first.pagination.sources.nextCursor}),e=>e.status===400);
 }finally{f.close();}
});
test('authority revocation/limit changes prevent disclosure across and during pages',async()=>{
 const f=fixture();try{
  const first=await readBookingRefunds(f.db,actor,headers(),{}, {dataset:'sources',pageSize:3});
  f.database.exec('UPDATE operator_accounts SET approval_limit_cents=0');
  const restricted=await readBookingRefunds(f.db,actor,headers(),{}, {dataset:'sources',cursor:first.pagination.sources.nextCursor});assert.deepEqual(restricted.sources,[]);assert.equal(restricted.pagination.sources.hasMore,false);
  f.database.exec('UPDATE operator_accounts SET approval_limit_cents=1000');
  f.afterAll(sql=>{if(sql.includes('__page_key'))f.database.exec('UPDATE operator_accounts SET approval_limit_cents=0');});
  await assert.rejects(()=>readBookingRefunds(f.db,actor,headers()),e=>e.status===409);
  f.afterAll(undefined);f.database.exec("UPDATE operator_role_assignments SET status='revoked'");await assert.rejects(()=>readBookingRefunds(f.db,actor,headers()),e=>e.status===403);
 }finally{f.close();}
});
test('refund GET validates pagination and retains private no-store responses',async()=>{
 const f=fixture(),oldDb=env.DB,oldAccess=env.LOKD_PILOT_ACCESS_JSON;env.DB=f.db;env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:[actor.email]});
 const get=query=>GET(new Request('https://lokd.co.za/api/booking-refunds'+query,{headers:headers()}));
 try{
  const good=await get('?dataset=sources&pageSize=2');assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'private, no-store');assert.equal((await good.json()).sources.length,2);
  for(const query of ['?pageSize=101','?pageSize=1&pageSize=2','?offset=5','?dataset=cases&sourcesCursor=bad','?cursor=bad','?dataset=invalid']){const r=await get(query);assert.equal(r.status,400,query);assert.equal(r.headers.get('cache-control'),'private, no-store');}
 }finally{if(oldDb===undefined)delete env.DB;else env.DB=oldDb;if(oldAccess===undefined)delete env.LOKD_PILOT_ACCESS_JSON;else env.LOKD_PILOT_ACCESS_JSON=oldAccess;f.close();}
});
