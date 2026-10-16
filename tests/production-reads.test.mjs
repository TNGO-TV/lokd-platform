import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {readProductionOperations} from '../app/lib/production-operations.ts';
import {productionOperationsResponse} from '../app/lib/workspace-response-contracts.ts';

function fixture(fail='') {
 const sql=new DatabaseSync(':memory:');
 for(const name of fs.readdirSync(new URL('../drizzle',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const observed={active:0,max:0,queries:[]};
 const prepare=(query,values=[])=>({
  bind:(...args)=>prepare(query,args),
  async all(){return {results:await read(query,values,false)};},
  async first(){return await read(query,values,true);},
 });
 async function read(query,values,first){
  assert.match(query,/^SELECT/i,'read path must not mutate');
  observed.queries.push({query,values}); observed.active++;observed.max=Math.max(observed.max,observed.active);
  try {await new Promise(resolve=>setImmediate(resolve));if(fail&&query.includes(fail))throw Error('storage unavailable');const stmt=sql.prepare(query);return first?stmt.get(...values)??null:stmt.all(...values);}
  finally {observed.active--;}
 }
 return {db:{prepare},sql,observed};
}
test('Operations reads overlap while ungranted finance and owner records remain inaccessible',async()=>{
 const f=fixture();try {
  const result=await readProductionOperations(f.db,{userId:'ungranted',email:'ungranted@example.invalid',operations:true,owner:false});
  assert.equal(productionOperationsResponse(result),true,'actual Operations read satisfies its consumer contract');
  assert.ok(f.observed.max>1,'independent readers should overlap');assert.ok(f.observed.max<=4);
  for(const key of ['partnerPaymentAccess','partnerDestinationAccess','partnerPayableAccess','employeePaymentAccess','destinationAccess'])assert.equal(result[key],false,key);
  for(const key of ['operators','payrollRuns','payrollItems','payrollCandidates','rosters','shifts','serviceOrders'])assert.deepEqual(result[key],[],key);
  assert.equal(f.observed.queries.some(({query})=>/FROM (employee_payment_instructions|partner_payment_instructions|payment_destination_current|partner_destination_current|production_partner_payable_current)/.test(query)),false);
 }finally{f.sql.close();}
});
test('ordinary account read retains ownership filters and excludes Operations-only records',async()=>{
 const f=fixture();try {
  const result=await readProductionOperations(f.db,{userId:'client-only',email:'client@example.invalid',operations:false,owner:false});
  assert.equal(productionOperationsResponse(result),true,'actual scoped read satisfies its consumer contract');
  assert.equal(result.owner,false);assert.deepEqual(result.approvals,[]);assert.deepEqual(result.operators,[]);assert.deepEqual(result.clientReviews,[]);assert.deepEqual(result.evidenceReviews,[]);
  const scoped=f.observed.queries.filter(({query})=>/FROM (roster_slots r|shifts s|production_order_setups p|booking_collection_requests r)/.test(query));
  assert.equal(scoped.length,4);for(const q of scoped)assert.ok(q.values.includes('client-only'));
 }finally{f.sql.close();}
});
test('a failed reader rejects the whole response rather than returning partial success',async()=>{
 const f=fixture('production_evidence_reviews');try {
  await assert.rejects(readProductionOperations(f.db,{userId:'ops',email:'ops@example.invalid',operations:true,owner:false}),/storage unavailable/);
  // Allow the other already-running read-only chains to finish before closing SQLite.
  for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));
 }finally{f.sql.close();}
});
