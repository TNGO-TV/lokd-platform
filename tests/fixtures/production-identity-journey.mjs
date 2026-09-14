// Isolated synthetic identity fixtures, extracted from the canonical ID-03 suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {POST as apply} from '../../app/api/applications/route.ts';
import {writeSignup} from '../../app/lib/signup-server.ts';
import {startProductionIdentity as start, decideProductionIdentity as decide} from '../../app/lib/production-identity.ts';
import {prepareProductionEntity} from '../../app/lib/production-intake.ts';
import {writePsiraCase} from '../../app/lib/psira-server.ts';
import {PSIRA_SOURCE} from '../../app/lib/psira-verification.ts';
import {prepareOfficerReview,decideOfficerReview} from '../../app/lib/production-officer-review.ts';
class D1 {
 constructor(beforeMigration){this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&(!beforeMigration||f<beforeMigration)).sort())this.sql.exec(fs.readFileSync(`drizzle/${f}`,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const database=this.sql;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
async function setup(pathway='qualified',psiraStatus='active',beforeMigration){
 const db=new D1(beforeMigration);env.DB=db;
 const response=await apply(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify({pathway,fullName:'Synthetic Officer',mobile:'0821234567',email:'identity@example.test',city:'Johannesburg',province:'Gauteng',psiraStatus,psiraNumber:psiraStatus==='active'?'1234567':'',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:pathway==='training'?['Entry-level security training']:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true})}));assert.equal(response.status,202);const caseId=(await response.json()).reference;
 await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'link',kind:'officer',id:caseId,expectedVersion:0});return {db,caseId,runtime:{DB:db,VERIFYNOW_API_KEY:undefined,VERIFYNOW_SANDBOX_ENABLED:'true'}};
}

const applicant={userId:'user_identity',email:'identity@example.test',operations:false};
const reviewer={userId:'independent_reviewer',email:'review@example.test',operations:true};
function fixture(){
 let submits=0,lookups=0;
 const result=b=>({...b,environment:'production',provider:'fixture-only',outcome:'verified',providerReference:'private-result',evidenceReference:'private-evidence',evidenceHash:'b'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});
 const port={key:'fixture-only',capture:async()=>({environment:'production',bindingHash:'a'.repeat(64)}),submit:async b=>{submits++;return result(b);},lookup:async b=>{lookups++;return result(b);}};
 return {port,result,counts:()=>({submits,lookups})};
}
const input=caseId=>({applicantId:caseId,applicantVersion:1,captureReference:'private-capture-fixture',consentVersion:'fixture-consent'});
const approve=(db,s,actor=reviewer)=>decide(db,actor,{id:s.id,outcomeId:s.outcomeId,decision:'approve',reason:'Independently inspected fixture evidence',independentlyChecked:true});


const maker={userId:'bridge-maker',email:'maker@example.test',operations:true,owner:false};
const checker={userId:'bridge-checker',email:'checker@example.test',operations:true,owner:true};
async function ready(beforeMigration){
 const {db,caseId}=await setup('qualified','active',beforeMigration);const f=fixture();
 await writeSignup(db,maker,{action:'review',kind:'officer',id:caseId,expectedVersion:1,status:'reviewed',note:'Synthetic intake review for isolated fixture'});
 let identity=await start(db,applicant,{...input(caseId),applicantVersion:2},f.port);identity=await approve(db,identity);
 const entity=await prepareProductionEntity(db,maker,{kind:'officer',caseId,caseVersion:2});
 const psiraId=await writePsiraCase(db,applicant,{action:'submit',declaration:'registered',psiraNumber:'1234567'});
 const psiraReview={action:'review',caseId:psiraId,expectedVersion:1,registrationStatus:'registered',identityMatch:'confirmed',recheckAt:new Date(Date.now()+86400000).toISOString(),evidence:{source:PSIRA_SOURCE,checkedAt:new Date().toISOString(),returnedNumber:'1234567',returnedName:'Synthetic Officer',returnedStatus:'Registered',grade:'A',certificateExpiry:'2099-01-01',employmentStatus:'Inactive',excerpt:'Isolated synthetic fixture only; no real registration assertion.',identityEvidence:'production-identity:'+identity.outcomeId}};
 await writePsiraCase(db,reviewer,psiraReview);
 const psiraEvent=db.sql.prepare('SELECT latest_event_id FROM psira_verification_cases WHERE id=?').get(psiraId).latest_event_id;
 const proposal={officerId:entity.entityId,applicantVersion:2,identityOutcomeId:identity.outcomeId,psiraEventId:psiraEvent,reason:'Synthetic independent identity and registration inspection'};
 return {db,caseId,f,identity,psiraId,psiraReview,proposal};
}
const decideBridge=(db,id,actor=checker,decision='approve')=>decideOfficerReview(db,actor,{reviewId:id,decision,independentlyChecked:true,reason:'Independent inspection of exact fixture evidence'});


import {prepareReadinessRule,prepareReadinessReview,decideReadiness,setReadinessOptIn,prepareReadinessPassport} from '../../app/lib/production-readiness.ts';
const assessor={userId:'readiness-assessor',email:'assessor@example.test',operations:true,owner:false};
const independent={userId:'readiness-checker',email:'ready-checker@example.test',operations:true,owner:true};
const decision=(db,kind,id,actor=independent)=>decideReadiness(db,actor,{kind,id,decision:'approve',independentlyInspected:true,reason:'Independently inspected isolated policy or applicant fixture'});
async function base(beforeMigration){const x=await ready(beforeMigration);const bridge=await prepareOfficerReview(x.db,maker,x.proposal);await decideBridge(x.db,bridge.reviewId);return {...x,officerId:x.proposal.officerId,bridgeId:bridge.reviewId};}
async function qualify(x,category,scope){
 const rule=await prepareReadinessRule(x.db,assessor,{code:category==='core'?'core_ready':category+'_'+scope.toLowerCase(),label:'Isolated '+category+' fixture',category,serviceType:category==='service'?scope:undefined,purposeCode:category==='purpose'?scope:undefined,requirements:['fixture assessment'],maxDays:7,evidenceReference:'private:isolated-policy-not-real',expiresAt:new Date(Date.now()+2*86400000).toISOString()});
 await decision(x.db,'rule',rule.id);
 const evidence=[{requirement:'fixture assessment',ownerUserId:applicant.userId,reference:'private:isolated-assessment-not-real',sha256:'c'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}];
 const input={officerId:x.officerId,officerReviewId:x.bridgeId,ruleId:rule.id,evidence,sourcesActuallyInspected:true};
 const review=await prepareReadinessReview(x.db,assessor,input);await decision(x.db,'review',review.id);return {rule,review,input};
}
async function complete({beforeMigration}={}){const x=await base(beforeMigration);x.core=await qualify(x,'core','');x.service=await qualify(x,'service','Unarmed');x.purpose=await qualify(x,'purpose','commercial_access');await setReadinessOptIn(x.db,applicant,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:0,optedIn:true});x.passportInput={officerId:x.officerId,officerReviewId:x.bridgeId,reviewIds:[x.core.review.id,x.service.review.id,x.purpose.review.id],expectedSequence:0};return x;}


export {complete,applicant,maker,checker,assessor,independent,decision,prepareReadinessPassport};
