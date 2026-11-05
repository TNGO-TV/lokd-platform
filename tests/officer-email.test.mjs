import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {enqueueOfficerEmail,deliverOfficerEmail} from '../app/lib/officer-email.ts';
import {installSmtpServer,smtpRuntime} from './fixtures/smtp-server.mjs';
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));}
 prepare(sql){const stmt=this.sql.prepare(sql);const make=(args=[])=>({bind:(...v)=>make(v),first:async()=>stmt.get(...args)??null,all:async()=>({results:stmt.all(...args)}),run:async()=>({meta:{changes:Number(stmt.run(...args).changes)}})});return make();}
 async batch(stmts){this.sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());this.sql.exec('COMMIT');return r;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const message={id:'confirmation:one',recipient:'officer@example.test',subject:'Your LOKD application',text:'Thank you for applying.'};
test('officer email stores missing configuration and never claims delivery',async()=>{
 const db=new D1();await enqueueOfficerEmail(db,message);let calls=0;
 assert.equal((await deliverOfficerEmail(db,{},message.id,async()=>{calls++;throw Error();})).sent,false);
 assert.equal(calls,0);const row=db.sql.prepare('SELECT state,last_error FROM officer_email_outbox').get();assert.equal(row.state,'failed');assert.match(row.last_error,/RESEND_API_KEY/);
});
test('officer email retries the same immutable payload and idempotency key after uncertain acceptance',async()=>{
 const db=new D1();await enqueueOfficerEmail(db,message);const runtime={RESEND_API_KEY:'fixture-key',LOKD_EMAIL_FROM:'team@example.test'},requests=[];
 const transport=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');requests.push(init);if(requests.length===1)throw Error('lost acknowledgement');return Response.json({id:'provider-one'});};
 assert.equal((await deliverOfficerEmail(db,runtime,message.id,transport)).sent,false);
 assert.equal((await deliverOfficerEmail(db,{...runtime,LOKD_EMAIL_FROM:'changed@example.test'},message.id,transport)).sent,true);
 assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['idempotency-key'],message.id);assert.equal(requests[1].headers['idempotency-key'],message.id);
 assert.equal((await deliverOfficerEmail(db,runtime,message.id,transport)).sent,true);assert.equal(requests.length,2);
 assert.equal(db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='officer_email_sent'").get().n,1);
});
test('uncertain officer email does not replay after Resend idempotency retention',async()=>{
 const db=new D1();await enqueueOfficerEmail(db,message);db.sql.prepare("UPDATE officer_email_outbox SET state='uncertain',created_at=?").run(new Date(Date.now()-86400000).toISOString());
 let calls=0;const result=await deliverOfficerEmail(db,{RESEND_API_KEY:'fixture',LOKD_EMAIL_FROM:'team@example.test'},message.id,async()=>{calls++;return Response.json({id:'later'});});
 assert.equal(result.sent,false);assert.equal(calls,0);assert.match(result.error,/Review/);
});
test('officer email sends through the SMTP mailbox and never replays an unconfirmed SMTP submission',async()=>{
 const db=new D1();await enqueueOfficerEmail(db,message);let lost=false;const server=installSmtpServer({mode:()=>lost?'lost':'accept'});
 const runtime={...smtpRuntime,LOKD_EMAIL_FROM:'notices@example.test'},transport=async url=>{assert.fail('No HTTP provider request expected: '+url);};
 try{
  assert.equal((await deliverOfficerEmail(db,runtime,message.id,transport)).sent,true);
  assert.equal(server.messages()[0].to,message.recipient);assert.match(db.sql.prepare('SELECT provider_id FROM officer_email_outbox').get().provider_id,/^smtp:/);
  const second={...message,id:'confirmation:two'};await enqueueOfficerEmail(db,second);lost=true;
  assert.equal((await deliverOfficerEmail(db,runtime,second.id,transport)).sent,false);
  assert.equal(db.sql.prepare('SELECT state FROM officer_email_outbox WHERE id=?').get(second.id).state,'uncertain');
  lost=false;const retry=await deliverOfficerEmail(db,runtime,second.id,transport);
  assert.equal(retry.sent,false);assert.match(retry.error,/sent mailbox/);assert.equal(server.messages().length,2);
 }finally{server.uninstall();}
});
