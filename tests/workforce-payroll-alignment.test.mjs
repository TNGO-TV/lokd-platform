import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {assertPayrollPolicy,calculatePayrollStatement,nightWorkAllocation,payrollPolicyWithReviewDefaults,ZA_2027_SARS_POLICY_CANDIDATE} from '../app/lib/payroll-engine.ts';
import {indicativeSingleShiftPrice} from '../app/lib/specialist-pricing.ts';
import {OFFICER_CONVERSION_POLICY,PERMANENT_ENGAGEMENT_CLAUSE,conversionTenurePercent} from '../app/lib/officer-conversion-core.ts';

function policy() {
  return structuredClone(ZA_2027_SARS_POLICY_CANDIDATE);
}
const service = {
  serviceDate:'2026-09-01',employerProjectedAnnualPayrollCents:100_000_000,
  earnings:[{code:'APPROVED_SERVICE',description:'Reviewed shift',minutes:720,baseHourlyRateCents:0,multiplierBasisPoints:10000,approvedServiceGrossCents:120000}],
};

test('NIGHT earnings default to 1.0 and use only the configured policy multiplier', () => {
  const input={...service,earnings:[{code:'NIGHT',description:'Night shift',minutes:720,baseHourlyRateCents:10000,multiplierBasisPoints:90000}]};
  for (const setting of [undefined,null,10000]) {
    const p=policy();p.wageRules.nightBasisPoints=setting;
    assert.equal(calculatePayrollStatement(input,p).grossCents,120000);
  }
  const p=policy();p.wageRules.nightBasisPoints=12500;
  assert.equal(calculatePayrollStatement(input,p).grossCents,150000);
  for (const rate of [-1,0,9999,10000.5,100001,NaN]) {
    p.wageRules.nightBasisPoints=rate;
    assert.throws(()=>assertPayrollPolicy(p),/night-work|payroll rate/i);
  }
});

test('night allocation uses 18:00–06:00 Johannesburg boundaries and handles mixed and cross-week shifts', () => {
  for (const [start,end,paid,night,grossBasis] of [
    ['2026-09-06T18:00:00+02:00','2026-09-07T06:00:00+02:00',720,720,140000],
    ['2026-09-06T06:00:00+02:00','2026-09-06T18:00:00+02:00',720,0,0],
    ['2026-09-06T17:00:00+02:00','2026-09-07T07:00:00+02:00',840,720,120000],
    ['2026-09-06T23:00:00+02:00','2026-09-07T08:00:00+02:00',540,420,108889],
  ]) {
    assert.deepEqual(nightWorkAllocation({startsAt:start,endsAt:end,paidMinutes:paid,grossCents:140000}),{minutes:night,grossBasisCents:grossBasis});
  }
  assert.deepEqual(nightWorkAllocation({startsAt:'2026-09-06T16:00:00Z',endsAt:'2026-09-07T04:00:00Z',paidMinutes:720,grossCents:140000}),{minutes:720,grossBasisCents:140000});
  assert.throws(()=>nightWorkAllocation({startsAt:'2026-09-06T18:00:00',endsAt:'2026-09-07T06:00:00',paidMinutes:720,grossCents:1}),/offset/);
  assert.throws(()=>nightWorkAllocation({startsAt:'2026-09-06T18:00:00Z',endsAt:'2026-09-06T17:00:00Z',paidMinutes:0,grossCents:0}),/interval/);
  assert.throws(()=>nightWorkAllocation({startsAt:'2026-09-06T18:00:00+02:00',endsAt:'2026-09-07T06:00:00+02:00',paidMinutes:660,grossCents:1}),/independently reviewed allocation/);
});

test('approved night premium is additional remuneration without duplicate leave minutes or overwritten source gross', () => {
  const input={...service,nightWork:{minutes:720,grossBasisCents:120000}};
  const ordinary=calculatePayrollStatement(input,policy());assert.equal(ordinary.grossCents,120000);
  const p=policy();p.wageRules.nightBasisPoints=12500;
  const night=calculatePayrollStatement(input,p);
  assert.equal(night.grossCents,150000);assert.equal(night.earnings[0].amountCents,120000);
  assert.equal(night.earnings[1].code,'NIGHT_PREMIUM');assert.equal(night.earnings[1].amountCents,30000);
  assert.equal(night.leaveAccruedMinutes,ordinary.leaveAccruedMinutes);
  assert.throws(()=>calculatePayrollStatement({...input,nightWork:{minutes:721,grossBasisCents:120000}},p),/allocation/);
  assert.throws(()=>calculatePayrollStatement({...input,nightWork:{minutes:720,grossBasisCents:120001}},p),/allocation/);
  assert.throws(()=>calculatePayrollStatement({...input,earnings:[{code:'NIGHT',description:'Night already paid',minutes:720,baseHourlyRateCents:10000,multiplierBasisPoints:10000}]},p),/duplicate/);
});

test('annual PSiRA policy fields have no preset payer or fee and pending amounts cannot alter payroll', () => {
  const p=policy();
  assert.deepEqual(p.psiraFees,{
    companyAnnual:{payer:null,amountCents:null,reviewStatus:'pending_review'},
    officerAnnual:{payer:null,amountCents:null,reviewStatus:'pending_review'},
  });
  const baseline=calculatePayrollStatement(service,p);
  p.psiraFees.companyAnnual={payer:'company',amountCents:99999999,reviewStatus:'pending_review'};
  p.psiraFees.officerAnnual={payer:'officer',amountCents:99999999,reviewStatus:'pending_review'};
  assert.deepEqual(calculatePayrollStatement(service,p),baseline);
  p.psiraFees.officerAnnual={payer:null,amountCents:null,reviewStatus:'approved'};
  assert.throws(()=>assertPayrollPolicy(p),/approved annual PSiRA fee/);
  p.psiraFees.officerAnnual={payer:'officer',amountCents:-1,reviewStatus:'pending_review'};
  assert.throws(()=>assertPayrollPolicy(p),/Annual PSiRA fee/);
});

test('new policy drafts add conservative review fields without altering or pre-approving historical policy content',()=>{
  const old=policy();delete old.psiraFees;delete old.coida.classificationReviewStatus;delete old.wageRules.nightBasisPoints;
  const copy=structuredClone(old),draft=payrollPolicyWithReviewDefaults(old);
  assert.deepEqual(old,copy);
  assert.deepEqual(draft.psiraFees,policy().psiraFees);
  assert.equal(draft.coida.classificationReviewStatus,'pending_review');
  assert.equal(draft.wageRules.nightBasisPoints,null);
  assert.deepEqual(calculatePayrollStatement(service,draft),calculatePayrollStatement(service,old));
});

test('COIDA remains zero until the classification is approved in the policy', () => {
  const p=policy();p.coida={enabled:true,classificationCode:'REVIEWED-CLASSIFICATION',employerRateBasisPoints:200,earningsCapPerPeriodCents:200000};
  for(const status of [undefined,'pending_review','rejected']) {
    p.coida.classificationReviewStatus=status;
    assert.equal(calculatePayrollStatement(service,p).coidaProvisionCents,0);
  }
  p.coida.classificationReviewStatus='approved';
  assert.equal(calculatePayrollStatement(service,p).coidaProvisionCents,2400);
  p.coida.classificationCode=null;
  assert.throws(()=>assertPayrollPolicy(p),/classification/);
});

test('pricing identifies the existing 2% reserve as provisional without changing the cost floor', () => {
  const q=indicativeSingleShiftPrice('standard_unarmed');
  assert.deepEqual(q.provisionalCoidaInsuranceReserve,{
    label:'Provisional COIDA/insurance reserve',status:'provisional',rateBasisPoints:200,
    amountCents:1600,
  });
  assert.equal(q.payrollBurdenCents,9200);
  assert.equal(q.costFloorCents,80000+q.payrollBurdenCents+q.readinessAndEquipmentCents+q.commandAndSupervisionCents+q.planningCents+q.travelCents+q.vehicleCents+q.overnightCents);
});

test('legal terms scope SAPS certification to firearms training and share the conversion contract', () => {
  const terms=fs.readFileSync('app/terms/page.tsx','utf8');
  assert.match(terms,/3\.4 LOKD is a SAPS-certified training provider for firearms competency training/);
  assert.match(terms,/Other courses are delivered by LOKD without claiming SAPS certification/);
  assert.match(terms,/Completing any training does not guarantee employment, an assignment or other work/);
  assert.doesNotMatch(terms,/We make no claim in these terms/);
  assert.match(terms,/<p>\{PERMANENT_ENGAGEMENT_CLAUSE\}<\/p>/);
  assert.match(terms,/OFFICER_CONVERSION_POLICY.tailMonths/);
  assert.match(terms,/OFFICER_CONVERSION_POLICY.directRecruitmentRateBps \/ 100/);
  assert.equal(OFFICER_CONVERSION_POLICY.tailMonths,6);
  assert.equal(OFFICER_CONVERSION_POLICY.officerPaysFee,false);
  assert.match(PERMANENT_ENGAGEMENT_CLAUSE,/six months after the later of the final assignment or introduction/);
  assert.deepEqual([0,4,7,13].map(conversionTenurePercent),[100,75,50,25]);
});

test('the partner correction preserves pending controls and direct routes and prevents regression', () => {
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE workforce_engagements(id TEXT,environment TEXT,model TEXT,payroll_status TEXT,benefits_status TEXT,version INTEGER,updated_at TEXT);CREATE TABLE production_workforce_holds(engagement_id TEXT)');
    db.exec("CREATE TRIGGER frozen_workforce_history BEFORE UPDATE ON workforce_engagements WHEN EXISTS(SELECT 1 FROM production_workforce_holds WHERE engagement_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Suspended workforce history cannot be rewritten'); END");
    const insert=db.prepare('INSERT INTO workforce_engagements VALUES(?,?,?,?,?,1,NULL)');
    for(const [id,environment,model,payroll,benefits] of [
      ['partner','production','partner','ready','ready'],['partial','production','partner','ready','pending'],
      ['pending','production','partner','pending','pending'],['direct','production','direct_flex','ready','ready'],
      ['managed','production','managed','ready','ready'],['other','isolated','partner','ready','ready'],
      ['held','production','partner','ready','ready'],
    ])insert.run(id,environment,model,payroll,benefits);
    db.exec("INSERT INTO production_workforce_holds VALUES('held')");
    db.exec(fs.readFileSync('drizzle/0183_partner_workforce_readiness.sql','utf8'));
    const row=id=>({...db.prepare('SELECT payroll_status,benefits_status,version FROM workforce_engagements WHERE id=?').get(id)});
    assert.deepEqual(row('partner'),{payroll_status:'partner_confirmed',benefits_status:'partner_confirmed',version:2});
    assert.deepEqual(row('partial'),{payroll_status:'partner_confirmed',benefits_status:'pending',version:2});
    for(const id of ['pending','direct','managed','other','held'])assert.equal(row(id).version,1);
    assert.equal(row('held').payroll_status,'ready');
    assert.throws(()=>insert.run('bad','production','partner','ready','ready'),/partner_confirmed/);
    assert.throws(()=>db.exec("UPDATE workforce_engagements SET benefits_status='ready' WHERE id='partner'"),/partner_confirmed/);
    assert.doesNotThrow(()=>insert.run('new','production','partner','partner_confirmed','partner_confirmed'));
  } finally {db.close();}
});

test('night-pay database guard rejects changed attendance before the calculation commits', () => {
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE payroll_policy_versions(id TEXT,rules_json TEXT);CREATE TABLE production_payroll_snapshots(policy_id TEXT,payload_json TEXT);CREATE TABLE shift_timesheets(id TEXT,check_in_at TEXT,check_out_at TEXT)');
    db.exec(fs.readFileSync('drizzle/0185_payroll_night_attendance.sql','utf8'));
    db.prepare('INSERT INTO payroll_policy_versions VALUES(?,?)').run('approved',JSON.stringify({wageRules:{nightBasisPoints:12500}}));
    db.prepare('INSERT INTO shift_timesheets VALUES(?,?,?)').run('source','2026-09-01T16:00:00Z','2026-09-02T04:00:00Z');
    const payload=JSON.stringify({items:[{sources:[{id:'source',check_in_at:'2026-09-01T16:00:00Z',check_out_at:'2026-09-02T04:00:00Z'}]}]});
    const insert=db.prepare('INSERT INTO production_payroll_snapshots VALUES(?,?)');
    assert.doesNotThrow(()=>insert.run('approved',payload));
    db.exec("UPDATE shift_timesheets SET check_in_at='2026-09-01T18:00:00Z'");
    assert.throws(()=>insert.run('approved',payload),/Night-work attendance changed/);
  } finally {db.close();}
});

test('owned production modules do not expose non-production execution switches or barred integrations',()=>{
  for(const name of ['workforce-core','assignment-activation-core','payroll-engine','production-payroll','production-payroll-policy','specialist-pricing','production-evidence','production-evidence-catalogue']) {
    const source=fs.readFileSync(`app/lib/${name}.ts`,'utf8');
    assert.doesNotMatch(source,/SANDBOX_ENABLED|DEMO_MODE|TEST_MODE|prelaunch|Clerk|Odoo|R350/,name);
    assert.doesNotMatch(source,/environment\s*===\s*['"](?:sandbox|demo|test)['"]/,name);
  }
});
