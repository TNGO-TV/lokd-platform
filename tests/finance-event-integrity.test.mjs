import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';

// The same module is an offline fixture loader in its child process. No temporary
// loader file or provider/account connection is used. Markers prove both modes run.
export async function load(url,context,nextLoad){
 const loaded=await nextLoad(url,context);
 if(!url.endsWith('/tests/fixtures/booking-refund-journey.mjs'))return loaded;
 const source=String(loaded.source);
 const probe=`
 await scenario(async()=>{
  const net=Math.floor(invoice.subtotal_cents/3),tax=Math.floor(invoice.tax_cents/3);
  const first=await prepare(net,tax,'qa-adopt-first','81001');
  const sparse={event:'refund.processed',data:{transaction_reference:ref,refund_reference:null,amount:String(net+tax),currency:'ZAR',domain:mode,status:'processed',integration:456}};
  const raw=JSON.stringify(sparse);await receiveBookingCollectionWebhook(new Request('https://lokd.co.za/api/paystack/booking/webhook',{method:'POST',body:raw,headers:{'x-paystack-signature':createHmac('sha512',secret).update(raw).digest('hex')}}),db,runtime,mode);
  request.requestKey='qa-adopt-first-fresh-'+mode;
  const fresh=await run(reviewer,request),one=database.prepare('SELECT * FROM booking_refund_cases WHERE id=?').get(fresh.caseId);await approve(one);
  async function adoptSettle(c,id,bank){
   await run(owner,{action:'adopt_refund',caseId:c.id,payloadHash:c.payload_hash,evidenceReviewed:true},async()=>Response.json({status:true,data:{...refund(c),id:Number(id),merchant_note:'external-existing'}}));
   const p=await run(reviewer,{action:'prepare_refund_receipt',caseId:c.id,evidenceReviewed:true,bankReference:bank,bankHash:(id==='81001'?'7':'8').repeat(64),bankAmountMinor:net+tax,note:'Independent QA synthetic bank proof'});
   const r=database.prepare('SELECT * FROM booking_refund_receipts WHERE id=?').get(p.receiptId);
   await run(owner,{action:'approve_refund_receipt',caseId:c.id,receiptId:r.id,payloadHash:r.payload_hash,evidenceReviewed:true,note:'Independent QA synthetic receipt'});
  }
  await adoptSettle(one,'81001','qa-bank-one-'+mode);
  const count=database.prepare("SELECT count(*) n FROM booking_collection_recoveries WHERE reference=? AND source='webhook' AND event='refund.processed'").get(ref).n;
  database.exec('PRAGMA recursive_triggers=OFF');
  for(const table of ['booking_collection_recoveries','booking_provider_recovery_inbox']){
   const consumed=database.prepare("SELECT * FROM "+table+" WHERE payload_hash=(SELECT payload_hash FROM booking_collection_recoveries WHERE reference=? AND source='webhook' AND event='refund.processed' LIMIT 1)").get(ref);
   assert.ok(consumed,table);const cols=Object.keys(consumed),before=JSON.stringify(database.prepare('SELECT * FROM '+table+' ORDER BY rowid').all());
   const insert=row=>database.prepare('INSERT OR REPLACE INTO '+table+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')').run(...cols.map(k=>row[k]));
   assert.equal(Number(insert({...consumed,id:'qa-replacement-'+table+'-'+mode,created_at:new Date().toISOString()}).changes),0);
   for(const key of ['payload_hash','detail','event'])assert.throws(()=>insert({...consumed,[key]:key==='payload_hash'?'f'.repeat(64):'changed'}),/immutable/i);
   assert.equal(JSON.stringify(database.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()),before);
  }
  const replayBefore=JSON.stringify(database.prepare('SELECT * FROM booking_collection_recoveries WHERE reference=? ORDER BY rowid').all(ref));
  await Promise.all([0,1].map(()=>receiveBookingCollectionWebhook(new Request('https://lokd.co.za/api/paystack/booking/webhook',{method:'POST',body:raw,headers:{'x-paystack-signature':createHmac('sha512',secret).update(raw).digest('hex')}}),db,runtime,mode)));
  assert.equal(JSON.stringify(database.prepare('SELECT * FROM booking_collection_recoveries WHERE reference=? ORDER BY rowid').all(ref)),replayBefore);
  const two=await prepare(net,tax,'qa-adopt-second','81002');await approve(two);
  await assert.rejects(()=>adoptSettle(two,'81002','qa-bank-two-'+mode),/signed.*final|signed.*event|consumed/i);
  assert.equal(database.prepare('SELECT reconciled_minor FROM booking_refund_accounting WHERE reference=?').get(ref).reconciled_minor,net+tax);
  await event(two,{id:81002});
  await run(owner,{action:'verify_refund',caseId:two.id,refundId:'81002'},async()=>Response.json({status:true,data:{...refund(two),id:81002,merchant_note:'external-existing'}}));
  const pp=await run(reviewer,{action:'prepare_refund_receipt',caseId:two.id,evidenceReviewed:true,bankReference:'qa-bank-two-'+mode,bankHash:'8'.repeat(64),bankAmountMinor:net+tax,note:'Distinct signed event and independent bank proof'});
  const rr=database.prepare('SELECT * FROM booking_refund_receipts WHERE id=?').get(pp.receiptId),payload=JSON.parse(rr.payload_json);
  assert.ok(payload.signedEventId);assert.equal(payload.signedEventHash,database.prepare('SELECT payload_hash FROM booking_collection_recoveries WHERE id=?').get(payload.signedEventId).payload_hash);
  const columns=Object.keys(rr),vals=Object.values({...rr,id:'qa-fake-'+mode,payload_json:JSON.stringify({...payload,signedEventHash:'0'.repeat(64)})});
  assert.throws(()=>database.prepare('INSERT INTO booking_refund_receipts('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').run(...vals),/signed|source|evidence/i);
  await run(owner,{action:'approve_refund_receipt',caseId:two.id,receiptId:rr.id,payloadHash:rr.payload_hash,evidenceReviewed:true,note:'Independent second event receipt'});
  assert.equal(database.prepare('SELECT reconciled_minor FROM booking_refund_accounting WHERE reference=?').get(ref).reconciled_minor,2*(net+tax));
  database.exec('PRAGMA recursive_triggers=OFF');
  const tables=['credit_notes','credit_note_decisions','credit_note_issues','booking_refund_cases','booking_refund_decisions','booking_refund_claims','booking_refund_observations','booking_refund_receipts','booking_refund_receipt_decisions'];
  let conflicts=0;
  for(const table of tables){
   const rows=database.prepare('SELECT * FROM '+table).all(),before=JSON.stringify(rows),row=rows[0];assert.ok(row,table);
   const cols=Object.keys(row),write=(verb,value)=>database.prepare(verb+' INTO '+table+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')').run(...cols.map(k=>value[k]));
   assert.throws(()=>write('INSERT OR REPLACE',row),/immutable/i);conflicts++;
   const info=database.prepare('PRAGMA table_info('+table+')').all(),pk=info.filter(x=>x.pk).map(x=>x.name);
   for(const index of database.prepare('PRAGMA index_list('+table+')').all().filter(x=>x.unique)){
    const keys=database.prepare('PRAGMA index_info('+index.name+')').all().map(x=>x.name);if(keys.some(k=>pk.includes(k)))continue;
    const altered={...row};for(const k of pk)altered[k]='qa-new-'+mode+'-'+table+'-'+index.name;
    assert.throws(()=>write('INSERT OR REPLACE',altered),/immutable/i);conflicts++;
   }
   assert.equal(JSON.stringify(database.prepare('SELECT * FROM '+table).all()),before);
  }
  console.log('QA_FINANCE_FIXED: '+mode+' single-event reuse denied; distinct second event accepted; event hash bound; '+conflicts+' PK/alternate-key replacements denied with rows preserved');

 });
`;
 return {...loaded,source:source.replace(' await scenario(async()=>{',probe+' await scenario(async()=>{')};
}

if(process.env.LOKD_FINANCE_EVENT_LOADER!=='1'){
 test('canonical finance event consumption and immutable conflict matrix',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const childEnv={...process.env,LOKD_FINANCE_EVENT_LOADER:'1'};delete childEnv.NODE_TEST_CONTEXT;
  const output=execFileSync(process.execPath,['--experimental-strip-types','--experimental-loader=./tests/cloudflare-loader.mjs','--experimental-loader='+fileURLToPath(import.meta.url),'--test-name-pattern=production intake prepares pending records','tests/assignment-activation-db.test.mjs'],{cwd:root,env:childEnv,encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
  for(const mode of ['test','live'])assert.match(output,new RegExp('QA_FINANCE_FIXED: '+mode+' single-event reuse denied'));
  assert.match(output,/# fail 0/);assert.match(output,/# skipped 0/);
 });
 test('original inbox late-link triggers preserve identity on duplicate projection',()=>{
  const db=new DatabaseSync(':memory:');
  const read=name=>fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8');
  const v53=read('0053_conscious_baron_strucker.sql'),v54=read('0054_large_lord_hawal.sql'),v71=read('0071_refund_reconciliation.sql');
  const trigger=(sql,name)=>{const statement=sql.split('--> statement-breakpoint').find(x=>x.includes('CREATE TRIGGER '+name+' '));assert.ok(statement,name);return statement;};
  try{
   db.exec('PRAGMA foreign_keys=ON; PRAGMA recursive_triggers=OFF; CREATE TABLE booking_collection_requests(reference TEXT PRIMARY KEY,mode TEXT,provider_id TEXT);');
   db.exec(v53.slice(0,v53.indexOf('CREATE TABLE `booking_settlement_decisions`')));
   db.exec(v54.slice(0,v54.indexOf('CREATE TRIGGER booking_recovery_inbox_link')));
   for(const name of ['booking_recovery_inbox_link','booking_recovery_late_transaction_link'])db.exec(trigger(v54,name));
   for(const name of ['booking_collection_recoveries_preserve_identity','booking_provider_recovery_inbox_preserve_identity'])db.exec(trigger(v71,name));
   for(const known of [false,true]){
    const ref='late-'+known,hash=(known?'a':'b').repeat(64),provider=known?'100':'200';
    db.prepare('INSERT INTO booking_collection_requests VALUES(?,?,NULL)').run(ref,'test');
    db.prepare('INSERT INTO booking_provider_recovery_inbox VALUES(?,?,?,?,?,?,?,?)').run('inbox-'+known,'test',provider,known?ref:null,'refund.processed',hash,'{}','2026-09-14T12:00:00.000Z');
    const before=db.prepare('SELECT * FROM booking_collection_recoveries WHERE reference=?').all(ref);assert.equal(before.length,known?1:0);
    db.prepare('UPDATE booking_collection_requests SET provider_id=? WHERE reference=?').run(provider,ref);
    const after=db.prepare('SELECT * FROM booking_collection_recoveries WHERE reference=?').all(ref);assert.equal(after.length,1);if(known)assert.deepEqual(after,before);
   }
  }finally{db.close();}
 });
}
