import assert from 'node:assert/strict';
import test from 'node:test';
import {env} from 'cloudflare:workers';
import {D1} from './fixtures/production-identity-journey.mjs';
import {submitOfficerApplication} from '../app/api/applications/route.ts';
import {writeSignup} from '../app/lib/signup-server.ts';
import {GET,POST} from '../app/api/enrolment/route.ts';
const actor={userId:'enrolment-owner',email:'enrol@example.test',operations:false};
function request(method,body,actorId=actor.userId){return new Request('https://officers.lokd.co.za/api/enrolment'+(method==='GET'?'?caseId='+body:''),{method,headers:{'content-type':'application/json',origin:'https://officers.lokd.co.za','x-lokd-verified-user-id':actorId,'x-lokd-verified-email':actor.email},...(method==='POST'?{body:JSON.stringify(body)}:{})});}
test('enrolment contact request is owned, consented, versioned, audited and replay safe without a payment provider',async()=>{
 const db=new D1();env.DB=db;
 try{
  const response=await submitOfficerApplication(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pathway:'training',fullName:'Fixture Officer',mobile:'0821234567',email:actor.email,city:'Pretoria',province:'Gauteng',psiraStatus:'not_registered',services:['Unarmed'],purposes:['School'],training:['Entry-level security training'],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true})}));
  assert.equal(response.status,202);const {reference}=await response.json();await writeSignup(db,actor,{kind:'officer',id:reference,action:'link',expectedVersion:0});
  const input={caseId:reference,caseVersion:1,action:'request_enrolment',consent:true};
  assert.equal((await POST(request('POST',{...input,consent:false}))).status,400);
  assert.equal((await POST(request('POST',input,'another-account'))).status,404);
  assert.equal((await POST(request('POST',{...input,caseVersion:0}))).status,409);
  const first=await POST(request('POST',input)),repeat=await POST(request('POST',input));assert.equal(first.status,200);assert.deepEqual(await first.json(),await repeat.json());
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM officer_enrolment_requests').get().n,1);
  assert.equal(db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='officer_enrolment_requested'").get().n,1);
  assert.equal((await GET(request('GET',reference))).status,200);
  await writeSignup(db,actor,{kind:'officer',id:reference,action:'withdraw',expectedVersion:1});assert.equal((await POST(request('POST',input))).status,404);
 }finally{db.sql.close();}
});
