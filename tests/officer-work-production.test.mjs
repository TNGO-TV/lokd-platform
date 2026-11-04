import test from 'node:test';
import assert from 'node:assert/strict';
import {env} from 'cloudflare:workers';
import {complete,applicant,maker,checker,assessor,decision,prepareReadinessPassport,D1} from './fixtures/production-identity-journey.mjs';
import {D1Adapter,seedEnvironment,seedOfficerSupport,moveCandidateToCheckInWindow,passDueScheduledCheckpoints,request,activateAssignment} from './fixtures/identity-activation-environment.mjs';
import {suspendOfficerApproval} from '../app/lib/production-officer-review.ts';
import {manageProductionEvidence} from '../app/lib/production-evidence.ts';
import {readOfficerWork,writeOfficerWork,validateAttendanceLocation} from '../app/lib/officer-work.ts';
import {GET,POST} from '../app/api/onboarding/route.ts';

async function connected(){
 const x=await complete(),database=x.db.sql;await seedEnvironment(database);
 const fields={engagementId:'OFFICER-WORK-ENGAGEMENT',officerId:x.officerId,employerId:'EMP-1',model:'direct_flex',termsVersion:'TERMS-v1',engagementReference:'private:fixture-engagement',weeklyHourCap:'24',payrollReference:'private:fixture-payroll',benefitsReference:'private:fixture-benefits'};
 const engagement=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind:'engagement',fields,sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString()});
 await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:engagement.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independent fixture evidence inspection'});
 seedOfficerSupport(database,x.officerId,fields.engagementId,'WORK-TERMS');
 database.prepare("UPDATE officers SET banking_status='verified',flex_available=1,external_work_acknowledged=1,rest_window_confirmed=1 WHERE id=?").run(x.officerId);
 const passport=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',passport.id);
 await moveCandidateToCheckInWindow(database,x.officerId);
 return {...x,database,db:new D1Adapter(database)};
}
function location(x){const site=x.database.prepare('SELECT latitude_e6,longitude_e6 FROM operational_sites LIMIT 1').get();return {locationConsent:true,latitude:site.latitude_e6/1e6,longitude:site.longitude_e6/1e6,accuracy:5,capturedAt:new Date().toISOString()};}

test('location must be recent, precise and entirely within the site geofence',()=>{
 const now=Date.now(),site={latitude_e6:-26100000,longitude_e6:28000000,geofence_radius_meters:120};
 const point={latitude:-26.1,longitude:28,accuracy:10,capturedAt:new Date(now).toISOString()};
 assert.equal(validateAttendanceLocation(point,site,now).distance,0);
 for(const change of [{latitude:NaN},{accuracy:151},{latitude:-26.2},{capturedAt:new Date(now-120001).toISOString()}])assert.throws(()=>validateAttendanceLocation({...point,...change},site,now));
});

test('new account has actual empty shift/pay state and audited email preference',async()=>{
 const db=new D1();
 const initial=await readOfficerWork(db,applicant);assert.equal(initial.officer,null);assert.deepEqual(initial.offers,[]);assert.deepEqual(initial.statements,[]);
 await writeOfficerWork(db,applicant,{action:'email_preference',enabled:false});assert.equal((await readOfficerWork(db,applicant)).emailEnabled,false);
 assert.equal(db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='email_preference_updated'").get().n,1);db.sql.close();
});

test('offer response is owner-bound, expiry-checked, audited and replay-safe',async()=>{
 const x=await connected();
 const booking=x.database.prepare("SELECT id FROM bookings WHERE environment='production' LIMIT 1").get().id;
 x.database.prepare("UPDATE booking_funding_reconciliations SET integrity_state='production_verified' WHERE booking_id=?").run(booking);
 x.database.prepare("INSERT INTO offers(id,booking_id,officer_id,amount_cents,status,expires_at) VALUES('work-offer',?,?,80000,'open',?)").run(booking,x.officerId,new Date(Date.now()+3600000).toISOString());
 assert.equal((await readOfficerWork(x.db,applicant)).offers.length,1);
 await assert.rejects(writeOfficerWork(x.db,{userId:'unrelated',email:'other@example.test'},{action:'accept_offer',offerId:'work-offer'}));
 await writeOfficerWork(x.db,applicant,{action:'accept_offer',offerId:'work-offer'});
 await writeOfficerWork(x.db,applicant,{action:'accept_offer',offerId:'work-offer'});
 assert.equal(x.database.prepare("SELECT status FROM offers WHERE id='work-offer'").get().status,'accepted');
 assert.equal(x.database.prepare("SELECT count(*) AS n FROM officer_offer_responses").get().n,1);
 assert.equal(x.database.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='officer_offer_responded'").get().n,1);
 assert.equal(x.database.prepare("SELECT count(*) AS n FROM officer_email_outbox WHERE id LIKE 'officer-work-%'").get().n,1);
 await assert.rejects(writeOfficerWork(x.db,applicant,{action:'decline_offer',offerId:'work-offer'}));
 x.database.prepare("INSERT INTO offers(id,booking_id,officer_id,amount_cents,status,expires_at,position_index) VALUES('expired-offer',?,?,80000,'open',?,2)").run(booking,x.officerId,new Date(Date.now()-1000).toISOString());
 await assert.rejects(writeOfficerWork(x.db,applicant,{action:'accept_offer',offerId:'expired-offer'}));
 x.database.prepare("INSERT INTO offers(id,booking_id,officer_id,amount_cents,status,expires_at,position_index) VALUES('revoked-offer',?,?,80000,'open',?,3)").run(booking,x.officerId,new Date(Date.now()+3600000).toISOString());
 await suspendOfficerApproval(x.db,maker,x.officerId,'Fixture withdrawal of officer approval.');
 await assert.rejects(writeOfficerWork(x.db,applicant,{action:'accept_offer',offerId:'revoked-offer'}));
 await writeOfficerWork(x.db,applicant,{action:'decline_offer',offerId:'revoked-offer'});
 assert.equal(x.database.prepare("SELECT status FROM offers WHERE id='revoked-offer'").get().status,'declined');x.database.close();
});

test('activated production shift checks in/out with location and creates actual timesheet',async()=>{
 const x=await connected();const active=await activateAssignment(x.db,request('officer-work-checkin',x.officerId),'ops-fixture');assert.equal(active.state,'activated');await passDueScheduledCheckpoints(x.db);
 const before=await readOfficerWork(x.db,applicant);assert.equal(before.shifts[0].id,active.shiftId);assert.equal(before.shifts[0].status,'confirmed');
 await assert.rejects(writeOfficerWork(x.db,applicant,{action:'check_in',shiftId:active.shiftId,...location(x),locationConsent:false}));
 await writeOfficerWork(x.db,applicant,{action:'check_in',shiftId:active.shiftId,...location(x)});
 await writeOfficerWork(x.db,applicant,{action:'check_in',shiftId:active.shiftId,...location(x)});
 assert.equal((await readOfficerWork(x.db,applicant)).shifts[0].status,'on_post');
 await writeOfficerWork(x.db,applicant,{action:'check_out',shiftId:active.shiftId,...location(x)});
 const after=await readOfficerWork(x.db,applicant);assert.equal(after.shifts[0].status,'completed');assert.equal(after.timesheets.length,1);assert.equal(after.timesheets[0].status,'awaiting_review');assert.deepEqual(after.statements,[]);
 assert.equal(x.database.prepare("SELECT count(*) AS n FROM officer_attendance_locations WHERE status='recorded'").get().n,2);
 assert.equal((await readOfficerWork(x.db,{userId:'unrelated',email:'other@example.test'})).shifts.length,0);x.database.close();
});

test('officer onboarding API requires account and rejects cross-workspace commands',async()=>{
 env.DB=new D1();const url='https://officers.lokd.co.za/api/onboarding?scope=officer';
 assert.equal((await GET(new Request(url))).status,401);
 const headers={'x-lokd-verified-user-id':applicant.userId,'x-lokd-verified-email':applicant.email,'content-type':'application/json',origin:'https://officers.lokd.co.za'};
 assert.equal((await GET(new Request(url,{headers}))).status,200);
 assert.equal((await POST(new Request(url,{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{}'}))).status,403);env.DB.sql.close();
});
