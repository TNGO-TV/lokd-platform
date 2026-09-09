import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { env } from "cloudflare:workers";
import { GET, POST } from "../app/api/specialist/route.ts";
import * as pilot from "../app/api/pilot/route.ts";
import { requiredSpecialistChecks, runSpecialistRehearsals } from "../app/lib/specialist-operations-core.ts";
import { defaultRiskInput } from "../app/lib/pilot-pricing.ts";

class Prepared {
  constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values;}
  bind(...values){return new Prepared(this.db,this.sql,values);}
  async first(){return this.db.prepare(this.sql).get(...this.values)??null;}
  async all(){return {results:this.db.prepare(this.sql).all(...this.values)};}
  runSync(){return {meta:{changes:Number(this.db.prepare(this.sql).run(...this.values).changes)}};}
  async run(){return this.runSync();}
}
class D1 {
  constructor(db){this.db=db;}
  prepare(sql){return new Prepared(this.db,sql);}
  async batch(statements){this.db.exec("BEGIN");try{const results=statements.map(s=>s.runSync());this.db.exec("COMMIT");return results;}catch(e){this.db.exec("ROLLBACK");throw e;}}
}
function setup(){
  const db=new DatabaseSync(":memory:");db.exec("PRAGMA foreign_keys=ON");
  for(const file of fs.readdirSync(new URL("../drizzle",import.meta.url)).filter(x=>x.endsWith(".sql")).sort()) db.exec(fs.readFileSync(new URL(`../drizzle/${file}`,import.meta.url),"utf8").replaceAll("--> statement-breakpoint",""));
  env.DB=new D1(db);env.LOKD_APP_STAGE="demo";env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:["maker@lokd.example","checker@lokd.example"],clients:{"client@lokd.example":"CL-001","other@lokd.example":"CL-OTHER"},officers:{"officer@lokd.example":"OFF-001","other-officer@lokd.example":"OFF-OTHER"}});
  return db;
}
function request({scope="operations",email="maker@lokd.example",action,pack,host,download=false}={}){
  host??=scope==="operations"?"operations.lokd.co.za":scope==="client"?"portal.lokd.co.za":"officers.lokd.co.za";
  return new Request(`https://${host}/api/specialist?scope=${scope}${pack?`&pack=${pack}`:""}${download?"&download=1":""}`,{method:action?"POST":"GET",headers:{origin:`https://${host}`,"sec-fetch-site":"same-origin",...(email?{"x-lokd-verified-email":email,"x-lokd-verified-user-id":"user_fixture","x-lokd-verified-mfa-enrolled":"true","x-lokd-verified-second-factor-at":new Date(Date.now()-60000).toISOString()}:{}),...(action?{"content-type":"application/json"}:{})},body:action?JSON.stringify(action):undefined});
}
async function call(action,email="maker@lokd.example",status=200){const r=await POST(request({action,email}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data.state??data;}
async function current(){const r=await GET(request());assert.equal(r.status,200,await r.clone().text());return (await r.json()).state;}
const future=days=>new Date(Date.now()+days*86400000).toISOString();
async function commercial(){
  let s=await call({action:"submit_commercial",evidenceReference:"demo://cost-and-legal-review",expiresAt:future(60),version:0});
  s=await call({action:"approve_commercial",id:s.commercialReview.id,version:s.commercialReview.version},"checker@lokd.example");return s;
}
async function createArmed(db){
  const now=future(-1),until=future(90),startDate=future(14).slice(0,10);
  const makeRequest=(scope,action)=>new Request(`https://demo.lokd.co.za/api/pilot?scope=${scope}`,{method:"POST",headers:{"content-type":"application/json",origin:"https://demo.lokd.co.za","x-lokd-verified-email":"maker@lokd.example"},body:JSON.stringify(action)});
  let r=await pilot.POST(makeRequest("client",{action:"create_booking",commandId:"v34-specialist-booking-0001",siteName:"V34 Rosebank",siteArea:"Rosebank",addressLabel:"Synthetic site Johannesburg",postName:"Armed post",instructions:"Synthetic approved post instructions.",serviceType:"Armed",engagementModel:"flex",term:"single",rosterPattern:"daily",purposeCode:"high_value_retail",riskInput:defaultRiskInput,startDate,shift:"day",specialistConfiguration:{serviceCode:"armed_static",teamSize:1,vehicleClass:"none",planningHours:1,travelKmPerServiceDay:0,overnightDays:0}}));
  assert.equal(r.status,200,await r.clone().text());
  let b=(await current()).bookings[0];assert.ok(b);
  db.prepare(`UPDATE launch_controls SET status='passed',evidence_level='independently_verified',evidence_reference='demo://specialist-authority',verified_by='test-reviewer',verified_at=?,expires_at=?,version=version+1,updated_at=? WHERE code LIKE 'S%_SPECIALIST_%' OR code IN ('S1_ARMED_SERVICE_AUTHORITY','S2_VIP_SERVICE_AUTHORITY')`).run(now,until,now);
  r=await pilot.POST(makeRequest("operations",{action:"approve_risk_plan",bookingId:b.id}));assert.equal(r.status,200,await r.clone().text());
  db.prepare(`INSERT INTO booking_funding_reconciliations (id,booking_id,environment,integrity_state,provider,provider_reference,currency,expected_amount_cents,cleared_amount_cents,status,cleared_at,reconciled_at,evidence_reference,evidence_verified_at,evidence_expires_at,version,active_key,created_at)
    VALUES ('V34-FUND',?,'demo','synthetic','test_bank','V34-CLEARED','ZAR',?,?,'cleared_reconciled',?,?,'demo://clearing',?,?,1,?,?)`).run(b.id,b.totalCents,b.totalCents,now,now,now,until,b.id,now);
  b=(await current()).bookings.find(x=>x.id===b.id);assert.equal(b.planCurrent,1);assert.equal(b.authorityCurrent,1);assert.equal(b.fundingCurrent,1);
  return b;
}

test("four specialist scenarios exercise valid and invalid commercial controls",()=>{
  const scenarios=runSpecialistRehearsals();assert.equal(scenarios.length,4);
  for(const scenario of scenarios){assert.equal(scenario.status,"passed",JSON.stringify(scenario));assert.ok(scenario.totalCents>0);assert.ok(scenario.steps.length>=6);}
});

test("new specialist records reject anonymous fallback, unassigned users, wrong hosts and client writes",async()=>{
  const db=setup();try{
    assert.equal((await GET(request({email:null,host:"demo.lokd.co.za"}))).status,401);
    assert.equal((await GET(request({email:"outsider@lokd.example",host:"demo.lokd.co.za"}))).status,403);
    assert.equal((await GET(request({host:"officers.lokd.co.za"}))).status,403);
    assert.equal((await POST(request({scope:"client",email:"client@lokd.example",action:{action:"run_rehearsals"}}))).status,403);
    const s=await call({action:"run_rehearsals"});assert.equal(s.rehearsals[0].scenarios.length,4);
    env.LOKD_APP_STAGE="production";
    await call({action:"run_rehearsals"},"maker@lokd.example",403);
    assert.equal(db.prepare("SELECT count(*) AS n FROM operator_accounts WHERE environment='production'").get().n,0);
  }finally{db.close();}
});

test("commercial and partner approvals require a distinct operator and reject stale versions",async()=>{
  const db=setup();try{
    let s=await call({action:"submit_commercial",version:0,evidenceReference:"demo://review",expiresAt:future(60)});
    const cr=s.commercialReview;
    await call({action:"approve_commercial",id:cr.id,version:cr.version},"maker@lokd.example",403);
    await call({action:"approve_commercial",id:cr.id,version:999},"checker@lokd.example",409);
    s=await call({action:"approve_commercial",id:cr.id,version:cr.version},"checker@lokd.example");assert.equal(s.commercialReview.status,"approved");
    assert.throws(()=>db.prepare("UPDATE specialist_commercial_reviews SET evidence_reference='tampered',version=version+1 WHERE id=?").run(cr.id),/specialist_independent_review_required/);
    s=await call({action:"add_partner",name:"Synthetic protected transport",serviceCodes:["armed_movement"],evidenceReference:"demo://partner-pack",validFrom:future(-1),expiresAt:future(60)});
    const partner=s.partners[0];await call({action:"approve_partner",id:partner.id,version:partner.version},"maker@lokd.example",403);
    s=await call({action:"approve_partner",id:partner.id,version:partner.version},"checker@lokd.example");assert.equal(s.partners[0].status,"approved");
    assert.ok(db.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='specialist_revision'").get().n>=2);
  }finally{db.close();}
});

test("complete pack approval, scoped downloads, revocation and stale commercial snapshots",async()=>{
  const db=setup();try{
    await commercial();const b=await createArmed(db);
    const content={commandOwner:"Synthetic command owner",clientBrief:"Client-visible scope",officerBrief:"Officer-only instructions",officerIds:["OFF-001"],partnerId:"",checks:[]};
    let s=await call({action:"save_pack",bookingId:b.id,version:0,content});let p=s.packs[0];
    await call({action:"submit_pack",id:p.id,version:p.version},"maker@lokd.example",409);
    content.checks=requiredSpecialistChecks(b,content.officerIds).map(c=>({code:c.code,reference:`demo://evidence/${c.code}`,validFrom:future(-1),expiresAt:future(60)}));
    s=await call({action:"save_pack",bookingId:b.id,version:p.version,content});p=s.packs[0];
    assert.deepEqual(p.blockers,[]);
    s=await call({action:"submit_pack",id:p.id,version:p.version});p=s.packs[0];
    await call({action:"approve_pack",id:p.id,version:p.version},"maker@lokd.example",403);
    s=await call({action:"approve_pack",id:p.id,version:p.version},"checker@lokd.example");p=s.packs[0];
    assert.equal(p.status,"approved");assert.deepEqual(p.blockers,[]);
    const client=await GET(request({scope:"client",email:"client@lokd.example",pack:p.id}));assert.equal(client.status,200);const clientDoc=(await client.json()).document;
    assert.equal(clientDoc.totalCents,b.totalCents);assert.equal(clientDoc.internalCostFloorCents,undefined);assert.equal(clientDoc.officerInstructions,undefined);assert.equal(clientDoc.evidence,undefined);
    const officer=await GET(request({scope:"officer",email:"officer@lokd.example",pack:p.id}));assert.equal(officer.status,200);const officerDoc=(await officer.json()).document;assert.equal(officerDoc.instructions,content.officerBrief);assert.equal(officerDoc.totalCents,undefined);
    assert.equal((await GET(request({scope:"client",email:"other@lokd.example",pack:p.id}))).status,404);
    assert.equal((await GET(request({scope:"officer",email:"other-officer@lokd.example",pack:p.id}))).status,404);
    const download=await GET(request({scope:"client",email:"client@lokd.example",pack:p.id,download:true}));assert.match(await download.text(),/SIMULATION ONLY/);
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
  const db=setup();try{
    await commercial();const b=await createArmed(db);
    const content={commandOwner:"Command",clientBrief:"Scope",officerBrief:"Instructions",officerIds:["OFF-001"],partnerId:"",checks:[]};
    content.checks=requiredSpecialistChecks(b,content.officerIds).map(c=>({code:c.code,reference:`demo://${c.code}`,validFrom:future(-2),expiresAt:future(60)}));
    content.checks[0].expiresAt=future(-1);
    const s=await call({action:"save_pack",bookingId:b.id,version:0,content});const p=s.packs[0];
    db.prepare("UPDATE specialist_deployment_packs SET status='review',version=version+1 WHERE id=?").run(p.id);
    assert.throws(()=>db.prepare("UPDATE specialist_deployment_packs SET status='approved',version=version+1,approved_by='checker@lokd.example',approved_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?").run(p.id),/specialist_pack_controls_not_current/);
  }finally{db.close();}
});

test("production commercial approval requires recent MFA and cannot use simulation evidence",async()=>{
  const db=setup();try{
    env.LOKD_APP_STAGE="production";
    for(const [id,email] of [["prod-maker","maker@lokd.example"],["prod-checker","checker@lokd.example"]]) {
      db.prepare(`INSERT INTO operator_accounts
        (id,email,display_name,status,mfa_status,mfa_verified_at,approval_limit_cents,environment,integrity_state,version,created_at,updated_at)
        VALUES (?,?,'Test operator','active','verified',strftime('%Y-%m-%dT%H:%M:%SZ','now'),99999999,'production','authoritative',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run(id,email);
      db.prepare(`INSERT INTO operator_role_assignments (id,operator_id,role,status,environment,integrity_state,granted_by,granted_at)
        VALUES (?,?,'operations_owner','active','production','authoritative','test-fixture',CURRENT_TIMESTAMP)`).run(id+"-role",id);
    }
    await call({action:"submit_commercial",version:0,evidenceReference:"demo://review",expiresAt:future(60)},"maker@lokd.example",400);
    const s=await call({action:"submit_commercial",version:0,evidenceReference:"approval-record:cost-and-terms-001",expiresAt:future(60)});
    const cr=s.commercialReview;
    db.exec("UPDATE operator_accounts SET mfa_verified_at=datetime('now','-16 minutes') WHERE id='prod-checker'");
    await call({action:"approve_commercial",id:cr.id,version:cr.version},"checker@lokd.example",403);
    assert.throws(()=>db.prepare(`UPDATE specialist_commercial_reviews SET status='approved',version=version+1,
      approved_by='checker@lokd.example',approved_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?`).run(cr.id),/specialist_reviewer_role_or_mfa_required/);
    db.exec("UPDATE operator_accounts SET mfa_verified_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id='prod-checker'");
    const approved=await call({action:"approve_commercial",id:cr.id,version:cr.version},"checker@lokd.example");
    assert.equal(approved.commercialReview.status,"approved");
    await call({action:"run_rehearsals"},"maker@lokd.example",423);
  }finally{db.close();}
});

test("a production specialist offer cannot open without a current named deployment pack",async()=>{
  const db=setup();try{
    const b=await createArmed(db);
    const row=db.prepare("SELECT * FROM bookings WHERE id=?").get(b.id);
    db.exec(`INSERT INTO clients (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
      VALUES ('CL-PROD-V34','Test client','Contact','contact@example.test','approved','production','production_verified')`);
    Object.assign(row,{id:"BK-PROD-V34",client_id:"CL-PROD-V34",environment:"production",integrity_state:"production_verified",status:"site_review",funding_status:"site_review"});
    const fields=Object.keys(row);
    db.prepare(`INSERT INTO bookings (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")})`).run(...Object.values(row));
    assert.throws(()=>db.exec(`INSERT INTO offers (id,booking_id,officer_id,amount_cents,expires_at,status)
      VALUES ('OFFER-PROD-V34','BK-PROD-V34','OFF-001',200000,'2040-01-01','open')`),/specialist_approved_pack_required/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM offers WHERE id='OFFER-PROD-V34'").get().n,0);
  }finally{db.close();}
});
