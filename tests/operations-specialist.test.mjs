import {operationsDatabase,addOperator} from './fixtures/operations-db.mjs';
import {seedEnvironment} from './fixtures/identity-activation-environment.mjs';
import {runSpecialistRehearsals} from './fixtures/specialist-scenarios.mjs';
import assert from "node:assert/strict";
import test from "node:test";
import { env } from "cloudflare:workers";
import { GET, POST } from "../app/api/specialist/route.ts";
import { requiredSpecialistChecks } from "../app/lib/specialist-operations-core.ts";
import { defaultRiskInput,quoteBooking } from "../app/lib/production-pricing.ts";

async function setup(){
  const {sqlite:db,db:adapter}=operationsDatabase();env.DB=adapter;env.LOKD_APP_STAGE="production";
  for(const name of ['maker','checker'])addOperator(db,name,['operations_owner','operations_controller','compliance_reviewer'],999999999,name+'@lokd.example');
  await seedEnvironment(db);
  seedOfficer(db,'OFF-LOCAL-1','ENG-LOCAL-1','TERMS-LOCAL-1');
  return db;
}
const now=new Date(Date.now()-86400000).toISOString(),expiry='2041-12-31T23:59:59.999Z';
const run=(db,sql,...values)=>db.prepare(sql).run(...values);
function seedOfficer(database, id, engagementId, termsId) {
  run(database, `INSERT INTO officers
    (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry,approval_status,banking_status,
     flex_available,external_work_acknowledged,rest_window_confirmed,created_at)
    VALUES (?,?,?,?,?,?,?,?, 'approved','verified',1,1,1,?)`,
    id, `Officer ${id}`, `+2700${id}`, `${id.toLowerCase()}@example.test`, "Johannesburg", `PSIRA-${id}`, "Grade B", "2041-12-31", now);
  // Synthetic independently reviewed registration, separate from legacy compliance.
  run(database, `INSERT INTO psira_verification_cases
    (id,owner_user_id,owner_email,psira_number,version,latest_event_id,updated_at)
    VALUES (?,?,?,?,1,?,?)`, `PC-${id}`, `user_fixture_${id}`,
    `${id.toLowerCase()}@example.test`, `PSIRA-${id}`, `PE-${id}`, now);
  run(database, `INSERT INTO psira_verification_events
    (id,case_id,version,psira_number,kind,registration_status,identity_match,
     evidence_json,evidence_hash,recorded_by,recorded_at,recheck_at)
    VALUES (?,?,1,?,'review','registered','confirmed',?,?,?, ?,?)`,
    `PE-${id}`, `PC-${id}`, `PSIRA-${id}`,
    JSON.stringify({ grade: 'B', certificateExpiry: '2041-12-31',
      source: 'https://digitalservices.psira.co.za/verify-user/4',
      identityEvidence: 'Synthetic test identity match; no live acceptance.' }),
    'fixture-only', 'independent-reviewer@example.test', now, expiry);
  run(database, `INSERT INTO officer_passports
    (officer_id,passport_number,public_token_hash,status,readiness_label,environment,integrity_state,
     evidence_reference,issued_at,last_reviewed_at,next_review_at,updated_at)
    VALUES (?,?,?,'active','LOKD Ready','production','verified',?,?,?,?,?)`,
    id, `PASS-${id}`, `HASH-${id}`, `passport:evidence:${id}`, now, now, expiry, now);
  run(database, `INSERT INTO officer_services (officer_id,service_type,qualified,opted_in,qualification_expiry)
    VALUES (?,'Unarmed',1,1,'2041-12-31')`, id);
  for (const [suffix, code, category, serviceType, purposeCode] of [
    ["CORE", "core_ready", "core", null, null],
    ["SERVICE", "service_unarmed", "service", "Unarmed", null],
    ["PURPOSE", "purpose_commercial", "purpose", null, "commercial_access"],
  ]) run(database, `INSERT INTO officer_endorsements
    (id,officer_id,code,label,category,service_type,purpose_code,status,environment,integrity_state,
     evidence_reference,assessed_at,expires_at,next_due_at,assessor,client_visible)
    VALUES (?,?,?,?,?,?,?,'current','production','verified',?,?,'2041-12-31','2041-09-01','Fixture assessor',1)`,
    `END-${id}-${suffix}`, id, code, code, category, serviceType, purposeCode, `endorsement:evidence:${id}:${code}`, now);
  for (const recordType of ["identity", "psira"]) run(database, `INSERT INTO compliance_records
    (id,officer_id,record_type,status,environment,integrity_state,evidence_reference,verified_at,expires_at,next_due_at)
    VALUES (?,?,?,'current','production','verified',?,?,?,?)`,
    `CR-${id}-${recordType}`, id, recordType, `compliance:evidence:${id}:${recordType}`, now, expiry, "2041-09-01T00:00:00.000Z");
  run(database, `INSERT INTO workforce_engagements
    (id,officer_id,employer_id,model,environment,status,active_key,engagement_reference,terms_version,
     payroll_status,benefits_status,weekly_hour_cap,activated_at,review_due_at,version,created_at,updated_at)
    VALUES (?,?, 'EMP-1','direct_flex','production','active',?,?, 'TERMS-v1','ready','ready',24,?,?,1,?,?)`,
    engagementId, id, id, `ENG-${id}`, now, expiry, now, now);
  run(database, `INSERT INTO workforce_terms_acceptances
    (id,workforce_engagement_id,officer_id,terms_version,acceptance_mode,environment,integrity_state,
     evidence_reference,accepted_at,expires_at,version,active_key,created_at)
    VALUES (?,?,?,'TERMS-v1','electronic','production','verified','terms:evidence',?,?,1,?,?)`, termsId, engagementId, id, now, expiry, engagementId, now);
  run(database, `INSERT INTO officer_availability_windows
    (id,officer_id,starts_at,ends_at,source,status,environment,integrity_state,evidence_reference,rest_confirmed_at,version,created_at)
    VALUES (?,?,?,?,'fixture','available','production','verified',?,?,1,?)`, `AV-${id}`, id,
    "2039-12-20T00:00:00.000Z", "2040-01-10T00:00:00.000Z", `availability:evidence:${id}`, now, now);
  run(database, `INSERT INTO officer_schedule_declarations
    (id,officer_id,version,status,environment,integrity_state,evidence_reference,declared_at,expires_at,supersedes_id,created_at)
    VALUES (?,?,1,'current','production','verified',?,?,?,NULL,?)`, `OSD-${id}`, id,
    `schedule:evidence:${id}`, now, expiry, now);
  run(database, `INSERT INTO officer_site_inductions
    (id,officer_id,site_id,induction_version,status,environment,integrity_state,evidence_reference,
     completed_at,expires_at,version,active_key,created_at)
    VALUES (?,?,'SITE-1','IND-v1','completed','production','verified','induction:evidence',?,?,1,?,?)`, `IND-${id}`, id, now, expiry, `${id}:SITE-1`, now);
  run(database, `INSERT INTO officer_travel_assessments
    (id,officer_id,site_id,status,environment,integrity_state,estimated_minutes,source,evidence_reference,
     assessed_at,valid_until,version,active_key,created_at)
    VALUES (?,?,'SITE-1','feasible','production','verified',30,'route_matrix','travel:evidence',?,?,1,?,?)`, `TRAVEL-${id}`, id, now, expiry, `${id}:SITE-1`, now);
}

function request({scope="operations",email="maker@lokd.example",action,pack,host,download=false}={}){
  host??=scope==="client"?"portal.lokd.co.za":scope==="officer"?"officers.lokd.co.za":"operations.lokd.co.za";
  return new Request(`https://${host}/api/specialist?scope=${scope}${pack?`&pack=${pack}`:""}${download?"&download=1":""}`,{method:action?"POST":"GET",headers:{origin:`https://${host}`,"sec-fetch-site":"same-origin",...(email?{"x-lokd-verified-email":email,"x-lokd-verified-user-id":email.split("@")[0],"x-lokd-verified-mfa-enrolled":"true","x-lokd-verified-second-factor-at":new Date(Date.now()-60000).toISOString()}:{}),...(action?{"content-type":"application/json"}:{})},body:action?JSON.stringify(action):undefined});
}
async function call(action,email="maker@lokd.example",status=200){const r=await POST(request({action,email}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data.state??data;}
async function current(){const r=await GET(request());assert.equal(r.status,200,await r.clone().text());return (await r.json()).state;}
const future=days=>new Date(Date.now()+days*86400000).toISOString();
async function commercial(){
  let s=await call({action:"submit_commercial",evidenceReference:"document:cost-and-legal-review",expiresAt:future(60),version:0});
  s=await call({action:"approve_commercial",id:s.commercialReview.id,version:s.commercialReview.version},"checker@lokd.example");return s;
}
async function createArmed(db){
 const startDate=future(14).slice(0,10),q=quoteBooking({serviceType:'Armed',engagementModel:'flex',term:'single',rosterPattern:'daily',purposeCode:'high_value_retail',startDate,shift:'day',riskInput:defaultRiskInput,specialistConfiguration:{serviceCode:'armed_static',vehicleClass:'none'}});
 db.exec("UPDATE bookings SET status='draft',funding_status='unfunded' WHERE id='BK-1'");
 const fields={service_type:'Armed',start_date:startDate,end_date:startDate,pricing_version:q.version,pricing_breakdown:JSON.stringify({...q,...q.pricingDecision}),specialist_service_code:q.specialistServiceCode,specialist_configuration:JSON.stringify(q.specialistConfiguration),quote_subtotal_cents:q.subtotalCents,vat_rate_basis_points:q.vatRateBasisPoints,vat_cents:q.vatCents,cost_floor_cents:q.costFloorCents,margin_cents:q.marginCents,margin_basis_points:q.marginBasisPoints,minimum_margin_basis_points:q.minimumMarginBasisPoints,pricing_status:q.pricingStatus,client_price_cents:q.clientPriceCents,officer_total_cents:q.officerTotalCents,gross_platform_contribution_cents:q.grossPlatformContributionCents,service_day_count:q.serviceDayCount,headcount:q.headcount,shift_count:q.shiftCount,risk_band:q.risk.band};
 db.prepare('UPDATE bookings SET '+Object.keys(fields).map(k=>k+'=?').join(',')+" WHERE id='BK-1'").run(...Object.values(fields));
 db.prepare("UPDATE roster_slots SET service_date=?,starts_at=?,ends_at=? WHERE booking_id='BK-1'").run(startDate,startDate+'T04:00:00.000Z',startDate+'T16:00:00.000Z');
 db.prepare("UPDATE launch_controls SET status='passed',evidence_level='independently_verified',evidence_reference='authority:reviewed-document',verified_by='fixture-reviewer',verified_at=?,expires_at=?,version=version+1,updated_at=? WHERE code LIKE 'S%_SPECIALIST_%' OR code IN ('S1_ARMED_SERVICE_AUTHORITY','S2_VIP_SERVICE_AUTHORITY')").run(now,expiry,now);
 db.prepare("UPDATE booking_funding_reconciliations SET expected_amount_cents=?,cleared_amount_cents=? WHERE booking_id='BK-1'").run(q.clientPriceCents,q.clientPriceCents);
 for(const table of ['site_risk_assessments','post_order_approvals','booking_funding_reconciliations'])db.exec("UPDATE "+table+" SET integrity_state='production_verified' WHERE environment='production'");
 const b=(await current()).bookings[0];assert.equal(b.pricingValid,1);assert.equal(b.planCurrent,1);assert.equal(b.authorityCurrent,1);assert.equal(b.fundingCurrent,1);return b;
}
function link(db,kind,name,entityId){
 const table=kind==='client'?'client_enquiries':'officer_applications',values={id:'case-'+name,environment:'prelaunch',integrity_state:'user_submitted',created_at:now,...(kind==='client'?{retention_review_at:future(90),privacy_acknowledged_at:now}:{})};
 for(const f of db.prepare('PRAGMA table_info('+table+')').all())if(f.notnull&&f.dflt_value===null&&!(f.name in values))values[f.name]=f.type.toLowerCase().includes('int')?0:'Local fixture';
 db.prepare('INSERT INTO '+table+'('+Object.keys(values).join(',')+') VALUES('+Object.keys(values).map(()=>'?').join(',')+')').run(...Object.values(values));
 db.prepare("INSERT INTO signup_cases(kind,source_id,owner_user_id,status,public_note,corrections_json,version,latest_event_id,updated_at) VALUES(?,?,?,'reviewed','','{}',1,'fixture-event',?)").run(kind,'case-'+name,name,now);
 db.prepare('INSERT INTO production_entity_links VALUES(?,?,1,?,?,?,?)').run(kind,'case-'+name,name,entityId,'fixture-reviewer',now);
}

test("four specialist scenarios exercise valid and invalid commercial controls",()=>{
  const scenarios=runSpecialistRehearsals();assert.equal(scenarios.length,4);
  for(const scenario of scenarios){assert.equal(scenario.status,"passed",JSON.stringify(scenario));assert.ok(scenario.totalCents>0);assert.ok(scenario.steps.length>=6);}
});

test("new specialist records reject anonymous fallback, unassigned users, wrong hosts and client writes",async()=>{
  const db=await setup();try{
    assert.equal((await GET(request({email:null}))).status,401);
    assert.equal((await GET(request({email:"outsider@lokd.example"}))).status,403);
    assert.equal((await GET(request({host:"officers.lokd.co.za"}))).status,403);
    assert.equal((await POST(request({scope:"client",email:"client@lokd.example",action:{action:"submit_commercial"}}))).status,403);
    const stale=request();stale.headers.delete('x-lokd-verified-second-factor-at');assert.equal((await GET(stale)).status,403);
    await call({action:"run_rehearsals"},"maker@lokd.example",400);
    assert.equal(db.prepare("SELECT count(*) AS n FROM operator_accounts WHERE environment='production'").get().n,2);
  }finally{db.close();}
});

test("commercial and partner approvals require a distinct operator and reject stale versions",async()=>{
  const db=await setup();try{
    let s=await call({action:"submit_commercial",version:0,evidenceReference:"document:review",expiresAt:future(60)});
    const cr=s.commercialReview;
    await call({action:"approve_commercial",id:cr.id,version:cr.version},"maker@lokd.example",403);
    await call({action:"approve_commercial",id:cr.id,version:999},"checker@lokd.example",409);
    s=await call({action:"approve_commercial",id:cr.id,version:cr.version},"checker@lokd.example");assert.equal(s.commercialReview.status,"approved");
    assert.throws(()=>db.prepare("UPDATE specialist_commercial_reviews SET evidence_reference='tampered',version=version+1 WHERE id=?").run(cr.id),/specialist_independent_review_required/);
    s=await call({action:"add_partner",name:"Fixture transport",serviceCodes:["armed_movement"],evidenceReference:"document:partner",validFrom:future(-1),expiresAt:future(60)});
    const partner=s.partners[0];await call({action:"approve_partner",id:partner.id,version:partner.version},"maker@lokd.example",403);
    s=await call({action:"approve_partner",id:partner.id,version:partner.version},"checker@lokd.example");assert.equal(s.partners[0].status,"approved");
    assert.ok(db.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='specialist_revision'").get().n>=2);
  }finally{db.close();}
});

test("complete pack approval, scoped downloads, revocation and stale commercial snapshots",async()=>{
  const db=await setup();try{
    await commercial();const b=await createArmed(db);
    const content={commandOwner:"Command owner",clientBrief:"Client-visible scope",officerBrief:"Officer-only instructions",officerIds:["OFF-LOCAL-1"],partnerId:"",checks:[]};
    let s=await call({action:"save_pack",bookingId:b.id,version:0,content});let p=s.packs[0];
    await call({action:"submit_pack",id:p.id,version:p.version},"maker@lokd.example",409);
    content.checks=requiredSpecialistChecks(b,content.officerIds).map(c=>({code:c.code,reference:`document:${c.code}`,validFrom:future(-1),expiresAt:future(60)}));
    s=await call({action:"save_pack",bookingId:b.id,version:p.version,content});p=s.packs[0];
    assert.deepEqual(p.blockers,[]);
    s=await call({action:"submit_pack",id:p.id,version:p.version});p=s.packs[0];
    await call({action:"approve_pack",id:p.id,version:p.version},"maker@lokd.example",403);
    s=await call({action:"approve_pack",id:p.id,version:p.version},"checker@lokd.example");p=s.packs[0];
    assert.equal(p.status,"approved");assert.deepEqual(p.blockers,[]);
    link(db,'client','client','CL-1');link(db,'client','other','CL-OTHER');link(db,'officer','officer','OFF-LOCAL-1');link(db,'officer','other-officer','OFF-OTHER');
    const client=await GET(request({scope:"client",email:"client@lokd.example",pack:p.id}));assert.equal(client.status,200);const clientDoc=(await client.json()).document;
    assert.equal(clientDoc.totalCents,b.totalCents);assert.equal(clientDoc.internalCostFloorCents,undefined);assert.equal(clientDoc.officerInstructions,undefined);assert.equal(clientDoc.evidence,undefined);
    const officer=await GET(request({scope:"officer",email:"officer@lokd.example",pack:p.id}));assert.equal(officer.status,200);const officerDoc=(await officer.json()).document;assert.equal(officerDoc.instructions,content.officerBrief);assert.equal(officerDoc.totalCents,undefined);
    assert.equal((await GET(request({scope:"client",email:"other@lokd.example",pack:p.id}))).status,404);
    assert.equal((await GET(request({scope:"officer",email:"other-officer@lokd.example",pack:p.id}))).status,404);
    const download=await GET(request({scope:"client",email:"client@lokd.example",pack:p.id,download:true}));assert.match(await download.text(),/APPROVED PACK/);
    assert.throws(()=>db.prepare("UPDATE specialist_deployment_packs SET content=json_set(content,'$.clientBrief','tampered'),version=version+1 WHERE id=?").run(p.id),/specialist_independent_review_required/);
    const cr=s.commercialReview;
    await call({action:"revoke_commercial",id:cr.id,version:cr.version},"checker@lokd.example");
    assert.equal((await GET(request({scope:"client",email:"client@lokd.example",pack:p.id}))).status,404);
    assert.equal(db.prepare("SELECT valid FROM specialist_pack_validation_v34 WHERE id=?").get(p.id).valid,0);
    assert.ok((await current()).packs[0].blockers.length>0);
    await call({action:"save_pack",bookingId:b.id,version:1,content},"maker@lokd.example",409);
  }finally{db.close();}
});

test("one expired required reference blocks independent approval at the database boundary",async()=>{
  const db=await setup();try{
    await commercial();const b=await createArmed(db);
    const content={commandOwner:"Command",clientBrief:"Scope",officerBrief:"Instructions",officerIds:["OFF-LOCAL-1"],partnerId:"",checks:[]};
    content.checks=requiredSpecialistChecks(b,content.officerIds).map(c=>({code:c.code,reference:`document:${c.code}`,validFrom:future(-2),expiresAt:future(60)}));
    content.checks[0].expiresAt=future(-1);
    const s=await call({action:"save_pack",bookingId:b.id,version:0,content});const p=s.packs[0];
    db.prepare("UPDATE specialist_deployment_packs SET status='review',version=version+1 WHERE id=?").run(p.id);
    assert.throws(()=>db.prepare("UPDATE specialist_deployment_packs SET status='approved',version=version+1,approved_by='checker@lokd.example',approved_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?").run(p.id),/specialist_pack_controls_not_current/);
  }finally{db.close();}
});

test("production commercial approval requires recent MFA and cannot use simulation evidence",async()=>{
  const db=await setup();try{
    await call({action:"submit_commercial",version:0,evidenceReference:"demo://review",expiresAt:future(60)},"maker@lokd.example",400);
    const s=await call({action:"submit_commercial",version:0,evidenceReference:"approval-record:cost-and-terms-001",expiresAt:future(60)});
    const cr=s.commercialReview;
    db.exec("UPDATE operator_accounts SET mfa_verified_at=datetime('now','-16 minutes') WHERE id='checker'");
    const stale=request({email:'checker@lokd.example',action:{action:'approve_commercial',id:cr.id,version:cr.version}});stale.headers.set('x-lokd-verified-second-factor-at',new Date(Date.now()-16*60000).toISOString());assert.equal((await POST(stale)).status,403);
    assert.throws(()=>db.prepare(`UPDATE specialist_commercial_reviews SET status='approved',version=version+1,
      approved_by='checker@lokd.example',approved_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?`).run(cr.id),/specialist_reviewer_role_or_mfa_required/);
    db.exec("UPDATE operator_accounts SET mfa_verified_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id='checker'");
    const approved=await call({action:"approve_commercial",id:cr.id,version:cr.version},"checker@lokd.example");
    assert.equal(approved.commercialReview.status,"approved");
    await call({action:"run_rehearsals"},"maker@lokd.example",400);
  }finally{db.close();}
});

test("a production specialist offer stays blocked when pack and source controls are missing",async()=>{
  const db=await setup();try{
    const b=await createArmed(db);
    const row=db.prepare("SELECT * FROM bookings WHERE id=?").get(b.id);
    db.exec(`INSERT INTO clients (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
      VALUES ('CL-PROD-V34','Test client','Contact','contact@example.test','approved','production','production_verified')`);
    Object.assign(row,{id:"BK-PROD-V34",client_id:"CL-PROD-V34",environment:"production",integrity_state:"production_verified",status:"site_review",funding_status:"site_review"});
    const fields=Object.keys(row);
    db.prepare(`INSERT INTO bookings (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")})`).run(...Object.values(row));
    assert.throws(()=>db.exec(`INSERT INTO offers (id,booking_id,officer_id,amount_cents,expires_at,status)
      VALUES ('OFFER-PROD-V34','BK-PROD-V34','OFF-LOCAL-1',200000,'2040-01-01','open')`),/specialist_(approved_pack_required|offer_controls_not_current)/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM offers WHERE id='OFFER-PROD-V34'").get().n,0);
  }finally{db.close();}
});
