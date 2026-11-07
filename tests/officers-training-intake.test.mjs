import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {env} from 'cloudflare:workers';
import {submitOfficerApplication} from '../app/api/applications/route.ts';
import * as training from '../app/api/training/route.ts';
import {applicationPsiraDeclaration,officerEntryPath,psiraIntakeStatus} from '../app/lib/psira-pathway.ts';
import {trainingCourses,currentIntakeMonth} from '../app/lib/training-courses.ts';
import {readTrainingBookings} from '../app/lib/training-bookings.ts';
import {deliverTrainingBookingEmails,runOperationalDelivery} from '../app/lib/operational-delivery.ts';
import {installSmtpServer,smtpRuntime} from './fixtures/smtp-server.mjs';

function fixture() {
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const prepare=(query,values=[])=>({bind(...bound){return prepare(query,bound);},async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}};}});
 const db={prepare,async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>s.run());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 return {sql,db,close(){sql.close();}};
}
const request=(path,input,headers={})=>new Request('https://lokd.co.za/api/'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://lokd.co.za',...headers},body:typeof input==='string'?input:JSON.stringify(input)});
const officer=()=>({requestKey:crypto.randomUUID(),entryPath:'registered',pathway:'qualified',fullName:'Officer Applicant',email:'officer@example.test',mobile:'0821234567',city:'Johannesburg',province:'Gauteng',psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade C',availability:['Weekdays','On-demand shifts'],services:['Unarmed'],purposes:['Retail'],training:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true});
const booking=()=>({requestKey:crypto.randomUUID(),course:'grade-e',preferredIntakeMonth:currentIntakeMonth(),fullName:'Training Applicant',mobile:'0821234567',email:'applicant@example.test',idStatus:'available',psiraStatus:'not_registered',consent:true});
const smtp={...smtpRuntime,LOKD_EMAIL_FROM:'notices@example.test'};
const count=(x,table)=>x.sql.prepare('SELECT count(*) n FROM '+table).get().n;

test('new and registered entry links preserve the existing three PSIRA intake statuses',()=>{
 assert.equal(officerEntryPath('registered'),'registered');assert.equal(officerEntryPath('new'),'new');assert.equal(officerEntryPath('training'),'new');
 assert.equal(officerEntryPath(null),'registered');
 for(const [path,status,expected] of [['qualified','active','psira_review_required'],['qualified','expired','psira_review_required'],['qualified','not_registered','registration_guidance'],['training','not_registered','training_requested']])assert.equal(psiraIntakeStatus(applicationPsiraDeclaration(path,status)),expected);
});
test('registered applications store grade, work interests and availability without granting approval',async()=>{
 const x=fixture();try{const result=await submitOfficerApplication(request('applications',officer()),x.db);assert.equal(result.status,202);const receipt=await result.json();assert.equal(receipt.pathwayStatus,'psira_review_required');
 const row=x.sql.prepare('SELECT * FROM officer_applications WHERE id=?').get(receipt.reference);assert.equal(row.status,'psira_review_required');assert.equal(row.psira_grade,'Grade C');
 assert.deepEqual(JSON.parse(x.sql.prepare('SELECT availability FROM officer_application_preferences').get().availability),['Weekdays','On-demand shifts']);assert.equal(count(x,'officers'),0);
 }finally{x.close();}
});
test('renewal applicants keep the expired registration status and receive renewal guidance',async()=>{
 const x=fixture();try{const input={...officer(),psiraStatus:'expired',renewalStatus:'refresher_requested'};const response=await submitOfficerApplication(request('applications',input),x.db);assert.equal(response.status,202);assert.equal((await response.json()).pathwayStatus,'psira_review_required');
 assert.equal(x.sql.prepare('SELECT psira_status FROM officer_applications').get().psira_status,'expired');assert.equal(x.sql.prepare('SELECT renewal_status FROM officer_application_preferences').get().renewal_status,'refresher_requested');assert.match(x.sql.prepare('SELECT message FROM officer_email_outbox').get().message,/renewal and refresher training/);
 }finally{x.close();}
});
for(const [label,change] of [['missing grade',{psiraGrade:''}],['missing availability',{availability:[]}],['invalid availability',{availability:['Everywhere']}],['missing renewal status',{psiraStatus:'expired'}],['invalid renewal status',{psiraStatus:'expired',renewalStatus:'approved'}],['mismatched route',{pathway:'training'}]])test('registered intake rejects '+label,async()=>{
 const x=fixture();try{assert.equal((await submitOfficerApplication(request('applications',{...officer(),...change}),x.db)).status,400);assert.equal(count(x,'officer_applications'),0);}finally{x.close();}
});
test('new applications store training interest and remain training_requested',async()=>{
 const x=fixture();try{const input={...officer(),entryPath:'new',pathway:'training',psiraStatus:'not_registered',psiraNumber:'',psiraGrade:'',availability:[],training:['Entry-level security training']};
 const response=await submitOfficerApplication(request('applications',input),x.db);assert.equal(response.status,202);assert.equal((await response.json()).pathwayStatus,'training_requested');
 assert.equal(x.sql.prepare('SELECT psira_number FROM officer_applications').get().psira_number,null);assert.deepEqual(JSON.parse(x.sql.prepare('SELECT training_interests FROM officer_applications').get().training_interests),input.training);
 }finally{x.close();}
});
test('availability and renewal preferences are atomic and part of the original receipt binding',async()=>{
 const x=fixture();try{const input=officer(),first=await(await submitOfficerApplication(request('applications',input),x.db)).json();assert.equal((await(await submitOfficerApplication(request('applications',input),x.db)).json()).reference,first.reference);assert.equal(count(x,'officer_application_preferences'),1);
 assert.equal((await submitOfficerApplication(request('applications',{...input,availability:['Night shifts']}),x.db)).status,409);
 x.sql.exec("CREATE TRIGGER fail_preferences BEFORE INSERT ON officer_application_preferences BEGIN SELECT RAISE(ABORT,'unavailable'); END;");
 assert.equal((await submitOfficerApplication(request('applications',officer()),x.db)).status,500);assert.equal(count(x,'officer_applications'),1);assert.equal(count(x,'officer_application_receipts'),1);
 }finally{x.close();}
});
test('every advertised training course saves an independent booking and two durable notices',async()=>{
 const x=fixture();try{for(const course of trainingCourses){const response=await training.submitTrainingBooking(request('training',{...booking(),course:course.id}),x.db);assert.equal(response.status,202);assert.match((await response.json()).reference,/^TRN-[0-9A-F-]{36}$/);}
 assert.equal(count(x,'training_bookings'),8);assert.equal(count(x,'officer_email_outbox'),16);assert.equal(count(x,'officer_applications'),0);assert.equal(x.sql.prepare("SELECT count(*) n FROM audit_events WHERE event_type='training_booking_requested'").get().n,8);
 const {bookings,hasMore}=await readTrainingBookings(x.db);assert.equal(bookings.length,8);assert.equal(hasMore,false);assert.equal(bookings[0].teamEmailStatus,'failed');
 const row=x.sql.prepare('SELECT * FROM training_bookings LIMIT 1').get();assert.equal(row.status,'requested');assert.equal(row.mobile_normalized,'+27821234567');assert.equal(row.email_normalized,'applicant@example.test');assert.equal(Object.keys(row).some(key=>/price|amount|payment|fee/.test(key)),false);
 assert.throws(()=>x.sql.prepare("UPDATE training_bookings SET course='grade-d'").run(),/immutable/);
 }finally{x.close();}
});
for(const [label,change] of [['unknown course',{course:'unknown'}],['past month',{preferredIntakeMonth:'2020-01'}],['invalid month',{preferredIntakeMonth:'2027-13'}],['invalid email',{email:'not-an-email'}],['invalid mobile',{mobile:'123'}],['missing consent',{consent:false}],['invalid ID status',{idStatus:'verified'}],['invalid PSIRA status',{psiraStatus:'approved'}],['invalid key',{requestKey:'invalid'}]])test('training booking rejects '+label,async()=>{
 const x=fixture();try{assert.equal((await training.submitTrainingBooking(request('training',{...booking(),...change}),x.db)).status,400);assert.equal(count(x,'training_bookings'),0);assert.equal(count(x,'officer_email_outbox'),0);}finally{x.close();}
});
test('training enforces same-origin JSON, bounded bodies and a non-fabricated honeypot receipt',async()=>{
 const x=fixture();try{for(const [input,headers,status] of [['null',{},400],['[]',{},400],['{',{},400],['x'.repeat(8001),{},413],[booking(),{origin:'https://untrusted.example'},403],[booking(),{'content-type':'text/plain'},415]])assert.equal((await training.submitTrainingBooking(request('training',input,headers),x.db)).status,status);
 const trapped=await training.submitTrainingBooking(request('training',{...booking(),company:'filled'}),x.db);assert.equal(trapped.status,202);assert.equal((await trapped.json()).saved,undefined);assert.equal(count(x,'training_bookings'),0);
 }finally{x.close();}
});
test('concurrent training retries share one booking and receipt while changed details conflict',async()=>{
 const x=fixture();try{const input=booking(),results=await Promise.all(Array.from({length:5},async()=>{const r=await training.submitTrainingBooking(request('training',input),x.db);assert.equal(r.status,202);return r.json();}));
 assert.equal(new Set(results.map(r=>r.reference)).size,1);assert.equal(count(x,'training_bookings'),1);assert.equal(count(x,'officer_email_outbox'),2);
 const conflict=await training.submitTrainingBooking(request('training',{...input,course:'grade-d'}),x.db);assert.equal(conflict.status,409);assert.equal((await conflict.json()).reference,undefined);
 const separate=await training.submitTrainingBooking(request('training',{...input,requestKey:crypto.randomUUID()}),x.db);assert.notEqual((await separate.json()).reference,results[0].reference);
 }finally{x.close();}
});
test('training booking, consent audit and notification jobs roll back together',async()=>{
 const x=fixture();try{x.sql.exec("CREATE TRIGGER fail_training BEFORE INSERT ON audit_events WHEN NEW.event_type='training_booking_requested' BEGIN SELECT RAISE(ABORT,'unavailable'); END;");assert.equal((await training.submitTrainingBooking(request('training',booking()),x.db)).status,500);assert.equal(count(x,'training_bookings'),0);assert.equal(count(x,'officer_email_outbox'),0);}finally{x.close();}
});
test('training sends the team and applicant their original messages through the SMTP mailbox once',async()=>{
 const x=fixture(),server=installSmtpServer();Object.assign(env,smtp);
 try{const input=booking(),r=await training.submitTrainingBooking(request('training',input),x.db),receipt=await r.json();assert.equal(receipt.teamEmailSent,true);assert.equal(receipt.confirmationEmailSent,true);
 assert.deepEqual(server.messages().map(m=>m.to).sort(),['applicant@example.test','training@lokd.co.za']);assert.ok(server.messages().every(m=>m.from==='notices@example.test'));
 const confirmation=server.messages().find(message=>message.to==='applicant@example.test');
 assert.match(confirmation.data,/Your booking is confirmed when the team confirms your course and intake/);
 assert.doesNotMatch(confirmation.data,/training@lokd\.co\.za/);
 await training.submitTrainingBooking(request('training',input),x.db);await deliverTrainingBookingEmails(x.db,smtp,receipt.reference);assert.equal(server.messages().length,2);
 }finally{for(const key of Object.keys(smtp))delete env[key];server.uninstall();x.close();}
});
test('an unknown SMTP outcome is not automatically resent on training retries or operational delivery',async()=>{
 const x=fixture(),server=installSmtpServer({mode:()=> 'lost'});Object.assign(env,smtp);
 try{const input=booking(),r=await training.submitTrainingBooking(request('training',input),x.db);assert.equal((await r.json()).saved,true);assert.equal(server.messages().length,2);
 assert.ok(x.sql.prepare('SELECT state FROM officer_email_outbox').all().every(r=>r.state==='uncertain'));
 await training.submitTrainingBooking(request('training',input),x.db);await runOperationalDelivery(x.db,smtp);assert.equal(server.messages().length,2);
 }finally{for(const key of Object.keys(smtp))delete env[key];server.uninstall();x.close();}
});
test('paused training notices stay queued and resume through the existing operational delivery runner',async()=>{
 const x=fixture(),server=installSmtpServer();Object.assign(env,smtp,{LOKD_OPERATIONAL_DELIVERY_ENABLED:'false'});
 try{await training.submitTrainingBooking(request('training',booking()),x.db);assert.equal(server.messages().length,0);assert.ok(x.sql.prepare('SELECT state FROM officer_email_outbox').all().every(r=>r.state==='queued'));
 await runOperationalDelivery(x.db,smtp);assert.equal(server.messages().length,2);
 }finally{for(const key of [...Object.keys(smtp),'LOKD_OPERATIONAL_DELIVERY_ENABLED'])delete env[key];server.uninstall();x.close();}
});
test('training queue and notification retries require Operations access and fresh MFA for writes',async()=>{
 const x=fixture();env.DB=x.db;env.LOKD_OWNER_ACCESS_JSON=JSON.stringify(['owner@example.test']);
 const owner=(method,body)=>new Request('https://operations.lokd.co.za/api/training',{method,headers:{origin:'https://operations.lokd.co.za','content-type':'application/json','x-lokd-verified-user-id':'owner','x-lokd-verified-email':'owner@example.test','x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()},body:body?JSON.stringify(body):undefined});
 try{const saved=await(await training.submitTrainingBooking(request('training',booking()),x.db)).json();assert.equal((await training.GET(new Request('https://lokd.co.za/api/training'))).status,401);
 const queue=await training.GET(owner('GET'));assert.equal(queue.status,200);assert.equal((await queue.json()).bookings[0].id,saved.reference);
 const stale=owner('PATCH',{id:saved.reference,action:'retry_emails'});stale.headers.delete('x-lokd-verified-second-factor-at');assert.equal((await training.PATCH(stale)).status,403);
 assert.equal((await training.PATCH(owner('PATCH',{id:saved.reference,action:'retry_emails'}))).status,200);
 }finally{delete env.DB;delete env.LOKD_OWNER_ACCESS_JSON;x.close();}
});
