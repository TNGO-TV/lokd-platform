import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {ZA_2027_SARS_POLICY_CANDIDATE,hourlyShiftPay,calculateHourlyPayrollStatement,calculatePayrollStatement,privateSecurityWageFloorDecision,payrollPolicyWithReviewDefaults,payrollPolicyWarnings} from '../app/lib/payroll-engine.ts';
import {bookingWorkforceRouteDecision} from '../app/lib/workforce-core.ts';
import {readOfficerEmployment,readOfficerHoursThisWeek} from '../app/lib/officer-employment.ts';
import {recordPolicyWarnings,readPolicyWarnings,overridePolicyWarning} from '../app/lib/workforce-policy-warnings.ts';
import {changeOfficerPayBasis} from '../app/lib/officer-pay-basis-commands.ts';
import {priceSpecialistCostFloor,defaultSpecialistConfiguration} from '../app/lib/specialist-pricing.ts';
import {ClientDatabase,seedClient,seedBooking,seedRoster} from './fixtures/client-booking-db.mjs';
const policy=()=>structuredClone(ZA_2027_SARS_POLICY_CANDIDATE);
const wage=(patch={})=>hourlyShiftPay({policy:policy(),serviceDate:'2026-11-02',area:'areas_one_and_two',grade:'C',attendedMinutes:720,agreedHourlyRateCents:3000,sundayOrPublicHoliday:false,...patch});

test('hourly Grade C Areas 1/2 uses R7,003 / 208 plus 15% without a monthly minimum refusal',()=>{
  assert.equal(wage().minimumHourlyRateCents,Math.ceil(700300/208*1.15));assert.equal(wage().hourlyRateCents,3872);assert.equal(wage().amountCents,46464);
  assert.equal(wage({agreedHourlyRateCents:5000}).amountCents,60000);
  assert.equal(wage({lowestMonthlyBasicCents:1000000}).minimumHourlyRateCents,Math.ceil(1000000/208*1.15));
});
test('hourly shifts under four hours receive four paid hours while worked minutes remain actual',()=>{
  const result=wage({attendedMinutes:90});assert.equal(result.paidMinutes,240);assert.equal(result.attendedMinutes,90);assert.equal(result.amountCents,15488);
});
for(const [name,serviceDate] of [['Sunday','2026-11-08'],['public holiday','2026-12-16']])test(`hourly ${name} pay doubles the rate and retains the four-hour minimum`,()=>{
  const result=wage({serviceDate,sundayOrPublicHoliday:true,attendedMinutes:120});assert.equal(result.amountCents,30976);assert.equal(result.multiplierBasisPoints,20000);
});
test('hourly premium, minimum, multiplier, divisor and threshold are editable policy values',()=>{
  const p=policy();Object.assign(p.hourlyPay,{premiumBasisPoints:2000,minimumShiftMinutes:300,hourlyDivisor:200,sundayPublicHolidayBasisPoints:25000,weeklyHourThreshold:20});
  const result=wage({policy:p,attendedMinutes:60,sundayOrPublicHoliday:true});assert.equal(result.minimumHourlyRateCents,4202);assert.equal(result.paidMinutes,300);assert.equal(result.amountCents,52525);
  assert.equal(payrollPolicyWithReviewDefaults({...p,hourlyPay:undefined}).hourlyPay.weeklyHourThreshold,24);
});
test('PSSPF and levy always apply to hourly and monthly pay, including pending rulings and disabled old settings',()=>{
  const p=policy();p.privateSecuritySector.providentFund.employeeRateBasisPoints=0;p.privateSecuritySector.providentFund.employerRateBasisPoints=0;p.privateSecuritySector.councilLevy.employeeMonthlyCents=0;
  for(const payBasis of ['hourly','monthly']){
    const result=calculatePayrollStatement({payBasis,serviceDate:'2026-11-02',employerProjectedAnnualPayrollCents:100000000,earnings:[{code:'APPROVED_SERVICE',description:'Reviewed service',minutes:720,baseHourlyRateCents:0,multiplierBasisPoints:10000,approvedServiceGrossCents:60000}]},p);
    assert.equal(result.employeeProvidentFundCents,4500);assert.equal(result.employerProvidentFundCents,4500);assert.equal(result.employeeCouncilLevyCents,940);assert.ok(result.employeeUifCents>0);assert.ok(result.employerUifCents>0);assert.ok(result.skillsDevelopmentLevyCents>0);
  }
  assert.ok(payrollPolicyWarnings(p).some(w=>w.code==='SECTOR_RULING_REVIEW'));
});
test('COIDA uses a recorded rate even before classification approval, and missing rate is a warning',()=>{
  const p=policy(),input={serviceDate:'2026-11-02',employerProjectedAnnualPayrollCents:100000000,earnings:[{code:'ORDINARY',description:'Recorded work',minutes:720,baseHourlyRateCents:5000,multiplierBasisPoints:10000}]};
  assert.ok(payrollPolicyWarnings(p).some(w=>w.code==='COIDA_RATE_MISSING'));
  p.coida={enabled:false,employerRateBasisPoints:200,earningsCapPerPeriodCents:0,classificationCode:null,classificationReviewStatus:'pending_review'};
  assert.equal(calculatePayrollStatement(input,p).coidaProvisionCents,1200);
});
test('monthly remuneration math is unchanged and a below-minimum decision can be displayed as a warning',()=>{
  const p=policy(),input={serviceDate:'2026-11-02',employerProjectedAnnualPayrollCents:100000000,earnings:[{code:'ORDINARY',description:'Monthly service',minutes:720,baseHourlyRateCents:5000,multiplierBasisPoints:10000}]};
  assert.deepEqual(calculatePayrollStatement(input,p),calculatePayrollStatement({...input,payBasis:'monthly'},p));
  assert.equal(privateSecurityWageFloorDecision({policy:p,serviceDate:input.serviceDate,area:'areas_one_and_two',grade:'C',monthlyBasicCents:700299}).compliant,false);
});
test('every direct LOKD route can staff Bolt, Flex and Fixed; hourly on Fixed carries review information',()=>{
  for(const model of ['bolt','flex','fixed'])for(const route of ['direct_flex','managed'])for(const basis of ['hourly','monthly'])assert.equal(bookingWorkforceRouteDecision(model,route,basis).ready,true);
  assert.ok(bookingWorkforceRouteDecision('fixed','managed','hourly').warnings.length);
  assert.equal(bookingWorkforceRouteDecision('bolt','partner','hourly').ready,false);
});
function employment(db,basis='hourly'){
  db.sql.exec("INSERT INTO officers(id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry) VALUES('pay-officer','Officer','0821234567','officer@example.test','Johannesburg','1234567','Grade C','2099-01-01'); INSERT INTO workforce_employers(id,legal_name,employer_type,status,environment) VALUES('employer','LOKD Security','lokd_employer','current','production');");
  db.sql.prepare("INSERT INTO workforce_engagements(id,officer_id,employer_id,model,pay_basis,agreed_hourly_rate_cents,pay_cadence,environment,status,active_key,engagement_reference,weekly_hour_cap) VALUES('engagement','pay-officer','employer','direct_flex',?,4000,?,'production','active','pay-officer','Reviewed document reference',24)").run(basis,basis==='hourly'?'weekly':'monthly');
}
test('cross-booking weekly observations include all commitments rather than resetting per booking',async()=>{
  const db=new ClientDatabase();try{
    employment(db);seedClient(db);
    for(const [id,start,end]of[['one','2090-01-02T04:00:00Z','2090-01-02T16:00:00Z'],['two','2090-01-03T04:00:00Z','2090-01-03T16:00:00Z'],['three','2090-01-04T04:00:00Z','2090-01-04T16:00:00Z']]){
      seedBooking(db,'CLIENT-FIXTURE-A',id);seedRoster(db,{bookingId:id,slotId:'slot-'+id,assigned:false});db.sql.prepare('UPDATE roster_slots SET starts_at=?,ends_at=?,service_date=? WHERE id=?').run(start,end,start.slice(0,10),'slot-'+id);
    }
    for(const id of ['one','two'])db.sql.prepare("INSERT INTO roster_assignments(id,roster_slot_id,officer_id,status,environment,integrity_state,assigned_by,assigned_at) VALUES(?,?,'pay-officer','reserved','production','production_verified','operator','2026-01-01')").run(id,'slot-'+id);
    const projected=db.sql.prepare("SELECT projected_minutes,cap_minutes FROM hourly_shift_hour_checks WHERE officer_id='pay-officer' AND slot_id='slot-three'").get();assert.equal(projected.projected_minutes,2160);assert.equal(projected.cap_minutes,1440);
    const summary=await readOfficerEmployment(db,'pay-officer',Date.parse('2090-01-02T00:00:00Z'));assert.equal(summary.committedHoursThisWeek,24);assert.equal(summary.hoursRemaining,0);
  }finally{db.sql.close();}
});
test('Operations can change pay basis; the actual person, time and request are audited without changing model history',async()=>{
  const db=new ClientDatabase();try{
    employment(db);const actor={userId:'pay-operator',email:'operator@example.test',operations:true};
    await changeOfficerPayBasis(db,actor,{engagementId:'engagement',expectedVersion:1,payBasis:'monthly',payCadence:'monthly',agreedHourlyRateCents:4000,reference:'Reviewed monthly agreement document'});
    assert.equal(db.sql.prepare("SELECT model FROM workforce_engagements WHERE id='engagement'").get().model,'direct_flex');assert.equal(db.sql.prepare("SELECT pay_basis FROM workforce_engagements WHERE id='engagement'").get().pay_basis,'monthly');
    const audit=db.sql.prepare("SELECT actor_id,created_at FROM audit_events WHERE event_type='officer_pay_basis_reviewed'").get();assert.equal(audit.actor_id,actor.userId);assert.ok(Date.parse(audit.created_at));
  }finally{db.sql.close();}
});
test('Officer hours use the SAST Monday boundary and retain attendance after engagement suspension',async()=>{
 const db=new ClientDatabase();try{
  employment(db);seedClient(db);seedBooking(db,'CLIENT-FIXTURE-A','worked-hours');
  db.sql.prepare("INSERT INTO shifts(id,booking_id,officer_id,scheduled_date,status,check_in_at,check_out_at,earnings_cents,environment,integrity_state) VALUES('worked-hours-shift','worked-hours','pay-officer','2026-11-01','completed','2026-11-01T20:00:00Z','2026-11-02T06:00:00Z',80000,'production','production_verified')").run();
  db.sql.prepare("UPDATE workforce_engagements SET status='suspended',active_key=NULL WHERE id='engagement'").run();
  assert.equal(await readOfficerHoursThisWeek(db,'pay-officer',Date.parse('2026-11-02T08:00:00Z')),8);
 }finally{db.sql.close();}
});
test('warnings and overrides retain immutable audit history; repeat overrides preserve the original actor and time',async()=>{
  const db=new ClientDatabase();try{
    await recordPolicyWarnings(db,{entityType:'payroll_run',entityId:'period',actorId:'maker',warnings:[{code:'MONTHLY_MINIMUM',detail:'Review the monthly wage minimum.'}]});
    const [warning]=await readPolicyWarnings(db);assert.ok(warning);
    await assert.rejects(()=>overridePolicyWarning(db,{userId:'officer',operations:false},{warningId:warning.id,reason:'Not authorised'}),/Operations access/);
    await overridePolicyWarning(db,{userId:'reviewer',operations:true},{warningId:warning.id,reason:'Reviewed source records and recorded the decision.'});
    await overridePolicyWarning(db,{userId:'other',operations:true},{warningId:warning.id,reason:'A repeat decision must not rewrite the first override.'});
    const [result]=await readPolicyWarnings(db);assert.equal(result.override_by,'reviewer');assert.ok(Date.parse(result.override_at));assert.equal(db.sql.prepare("SELECT count(*) n FROM audit_events WHERE event_type='workforce_policy_override'").get().n,1);
  }finally{db.sql.close();}
});
test('Bolt and Flex cost floors include hourly premium and the four-hour minimum; Fixed retains the monthly cost basis',()=>{
  const input={serviceCode:'standard_unarmed',serviceDayCount:1,shiftCount:1,officerTotalCents:80000,calendarAdjustedListSubtotalCents:140000,configuration:defaultSpecialistConfiguration.Unarmed};
  assert.equal(priceSpecialistCostFloor({...input,engagementModel:'fixed'}).payrollCostBasisCents,80000);
  for(const engagementModel of ['bolt','flex'])assert.equal(priceSpecialistCostFloor({...input,engagementModel}).payrollCostBasisCents,92000);
  assert.ok(priceSpecialistCostFloor({...input,officerTotalCents:1000,attendedMinutesPerShift:60}).payrollCostBasisCents>=Math.ceil(700300/208*1.15*4));
});
test('migration backfills pay basis while preserving historical workforce model names',()=>{
  const db=new DatabaseSync(':memory:');try{
    for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&f<'0193').sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
    db.exec("INSERT INTO officers(id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry) VALUES('o','Officer','1','officer@example.test','Johannesburg','1','Grade C','2099-01-01'); INSERT INTO workforce_employers(id,legal_name,employer_type) VALUES('e','LOKD','lokd_employer'); INSERT INTO workforce_engagements(id,officer_id,employer_id,model,engagement_reference) VALUES('h','o','e','direct_flex','reference'),('m','o','e','managed','reference');");
    db.exec(fs.readFileSync('drizzle/0193_officer_pay_basis.sql','utf8'));
    assert.deepEqual(db.prepare('SELECT pay_basis,pay_cadence,model FROM workforce_engagements ORDER BY id').all().map(x=>({...x})),[{pay_basis:'hourly',pay_cadence:'weekly',model:'direct_flex'},{pay_basis:'monthly',pay_cadence:'monthly',model:'managed'}]);
  }finally{db.close();}
});

test('hourly payroll calculates the floor by default and retains a reviewed below-floor shift with a warning',()=>{
 const p=policy(),shift={id:'hourly-shift',serviceDate:'2026-11-02',area:'areas_one_and_two',grade:'C',attendedMinutes:90,agreedHourlyRateCents:3000,sundayOrPublicHoliday:false};
 const input={serviceDate:shift.serviceDate,employerProjectedAnnualPayrollCents:100000000,shifts:[shift]};
 assert.equal(calculateHourlyPayrollStatement(input,p).grossCents,15488);
 assert.equal(calculateHourlyPayrollStatement({...input,shifts:[{...shift,reviewedGrossCents:10000}]},p).grossCents,15488);
 const reviewed=calculateHourlyPayrollStatement({...input,shifts:[{...shift,reviewedGrossCents:10000,useReviewedGross:true}]},p);
 assert.equal(reviewed.grossCents,10000);assert.ok(reviewed.warnings.some(w=>w.code==='HOURLY_FLOOR:hourly-shift'));assert.equal(reviewed.employeeProvidentFundCents,750);assert.equal(reviewed.employeeCouncilLevyCents,940);
});

test('three excessive weeks out of the last four prompt a recorded review without changing pay basis',async(testContext)=>{
 const db=new ClientDatabase();try{
  const {installFixtureClock}=await import('./fixtures/fixture-clock.mjs');installFixtureClock(testContext,db.sql,Date.parse('2026-11-08T12:00:00Z'));
  employment(db);seedClient(db);
  let index=0;
  for(const monday of ['2026-10-12','2026-10-19','2026-10-26'])for(const day of [0,2,4]){
   const date=new Date(Date.parse(monday)+day*86400000).toISOString().slice(0,10),booking='worked-'+index,shift='worked-shift-'+index++;
   seedBooking(db,'CLIENT-FIXTURE-A',booking);db.sql.prepare('UPDATE bookings SET start_date=?,end_date=? WHERE id=?').run(date,date,booking);
   db.sql.prepare("INSERT INTO shifts(id,booking_id,officer_id,scheduled_date,status,check_in_at,check_out_at,earnings_cents,environment,integrity_state) VALUES(?,?,'pay-officer',?,'completed',?,?,80000,'production','production_verified')").run(shift,booking,date,date+'T06:00:00+02:00',date+'T18:00:00+02:00');
  }
  const summary=await readOfficerEmployment(db,'pay-officer');assert.equal(summary.exceededWeeks,3);assert.equal(summary.conversionReviewRequired,true);
  const {readZoneOperations}=await import('../app/lib/zone-operations.ts');
  await readZoneOperations(db,{userId:'operations',email:'operations@example.test',operations:true});
  assert.ok((await readPolicyWarnings(db)).some(w=>w.code==='REPEATED_WEEKLY_HOURS_REVIEW'));
  assert.equal(db.sql.prepare("SELECT pay_basis FROM workforce_engagements WHERE id='engagement'").get().pay_basis,'hourly');
 }finally{db.sql.close();}
});
