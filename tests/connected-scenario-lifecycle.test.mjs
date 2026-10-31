import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {env} from 'cloudflare:workers';
import {prepareConnectedScenario} from './integrated-browser/connected-scenarios.mjs';
import {prepareBrowserPeriod,periodFixtureStart} from './integrated-browser/connected-period-source.mjs';
import {fixtureScope} from './fixtures/fixture-scope.mjs';
import {installFixtureClock} from './fixtures/fixture-clock.mjs';

const wallDate=Date;
const closed=db=>assert.throws(()=>db.prepare('SELECT 1'),/closed|not open/i);
const restored=before=>{assert.equal(Date,wallDate,'native Date constructor must be restored');assert.ok(Date.now()>=before&&Date.now()-before<60000,'mocked Date must be restored');};

test('failed scenario scope closes every resource once even when one cleanup throws',()=>{
 const scope=fixtureScope(),calls=[];
 scope.after(()=>calls.push('database'));scope.after(()=>{calls.push('clock');throw Error('cleanup probe');});
 assert.throws(()=>scope.close(),/Fixture cleanup failed/);scope.close();assert.deepEqual(calls,['clock','database']);
});

test('clock installation failure restores Date immediately and later cleanup is harmless',()=>{
 const before=Date.now(),callbacks=[];
 assert.throws(()=>installFixtureClock({mock,after:fn=>callbacks.push(fn)},{function(){throw Error('SQL registration probe');}},Date.parse('2026-01-01T00:00:00Z')),/SQL registration probe/);
 restored(before);for(const callback of callbacks)callback();restored(before);
});

test('partial identity bootstrap failure closes its database and resets the early fixture clock',async()=>{
 const before=Date.now();let sql;
 await assert.rejects(()=>prepareConnectedScenario('period',{now:Date.parse('2026-10-31T13:00:00Z'),configureDatabase:db=>{sql=db.sql;throw Error('bootstrap probe');}}),/bootstrap probe/);
 closed(sql);restored(before);
 const next=await prepareConnectedScenario('training');next.close();next.close();closed(next.database);closed(next.primaryDatabase);
});

for(const initial of ['2026-10-31T13:00:00Z','2026-11-01T13:00:00Z','2026-12-24T13:00:00Z']){
 test('cross-category booking reuse still rejects and cleans a failed period at '+initial,async()=>{
  const before=Date.now(),callbacks=[];let sql;
  await assert.rejects(()=>prepareBrowserPeriod({mock,after:fn=>callbacks.push(fn)},{now:Date.parse(initial),configureDatabase:db=>{sql=db.sql;}}),/activation_snapshot_source_binding_invalid/);
  closed(sql);closed(env.DB.sql);restored(before);for(const callback of callbacks)callback();restored(before);
  const next=await prepareConnectedScenario('training');try{assert.equal(next.meta.kind,'training');}finally{next.close();}
  restored(before);
 });
}

for(const [initial,date,category] of [
 ['2026-10-31T13:00:00Z','2026-10-31','ordinary'],
 ['2026-10-31T22:01:00Z','2026-11-01','sunday'],
 ['2026-12-24T22:01:00Z','2026-12-25','christmas'],
 ['2026-12-25T22:01:00Z','2026-12-26','christmas'],
 ['2026-12-15T22:01:00Z','2026-12-16','public_holiday'],
]){
 test('one-booking period preserves calendar economics and rest at '+initial,async()=>{
  const before=Date.now();assert.equal(new Date(periodFixtureStart(Date.parse(initial))).toISOString(),date+'T04:00:00.000Z');
  const scenario=await prepareConnectedScenario('period',{now:Date.parse(initial)});
  try{
   const slots=scenario.database.prepare('SELECT * FROM roster_slots ORDER BY starts_at').all();
   const booking=scenario.database.prepare("SELECT * FROM bookings WHERE id='BK-1'").get();
   assert.equal(slots.length,2);assert.equal(booking.calendar_category,category);
   for(const slot of slots){assert.equal(slot.service_date,date);assert.equal(slot.calendar_category,category);assert.equal(slot.officer_offer_cents,booking.officer_rate_cents);assert.equal(Date.parse(slot.ends_at)-Date.parse(slot.starts_at),3600000);}
   assert.ok(Date.parse(slots[1].starts_at)-Date.parse(slots[0].ends_at)>=8*3600000);
   const snapshots=scenario.database.prepare('SELECT calendar_category,funded_offer_cents FROM assignment_activation_snapshots WHERE final=1').all();
   assert.equal(snapshots.length,2);assert.ok(snapshots.every(row=>row.calendar_category===category&&row.funded_offer_cents===booking.officer_rate_cents));
   const sources=scenario.meta.sources;assert.equal(new Set(sources.map(row=>row.employer_id)).size,2);
   assert.ok(sources.every(row=>row.gross_wage_cents===booking.officer_rate_cents&&row.service_date===date));
   assert.deepEqual(scenario.database.prepare('SELECT * FROM shift_timesheets WHERE id=?').get(sources[0].id),sources[0]);
   assert.equal(scenario.primaryDatabase.prepare('SELECT count(*) n FROM officer_applications').get().n,0);
   console.log(JSON.stringify({initial,date,category,gross:scenario.meta.period.groups.reduce((sum,row)=>sum+row.grossCents,0),minimumRestHours:8,primaryApplications:0}));
  }finally{scenario.close();scenario.close();}
  closed(scenario.database);closed(scenario.primaryDatabase);restored(before);
 });
}


test('non-period scenario activation failure closes both stores and resets its clock',async()=>{
 const before=Date.now();let sql;
 await assert.rejects(()=>prepareConnectedScenario('service',{configureDatabase:db=>{
  sql=db.sql;sql.exec("CREATE TRIGGER scenario_failure_probe BEFORE INSERT ON assignment_activation_snapshots BEGIN SELECT RAISE(ABORT,'scenario_activation_probe'); END");
 }}),/scenario_activation_probe/);
 closed(sql);closed(env.DB.sql);restored(before);
 const next=await prepareConnectedScenario('training');next.close();restored(before);
});
