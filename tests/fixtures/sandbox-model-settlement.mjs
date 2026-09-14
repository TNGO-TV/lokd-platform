import assert from 'node:assert/strict';
import {createFinanceWorkspace,applyFinanceCommand} from '../../app/lib/finance-workflow-store.ts';
import {prepareFinanceCommand,readFinanceJourney,FINANCE_SANDBOX_POLICY} from '../../app/lib/finance-workflows.ts';
import {DeterministicFinanceProvider,dispatchFinanceOperation,financeSignature,acceptFinanceWebhook,attestFinanceBank} from '../../app/lib/finance-workflow-provider.ts';
const runtime={LOKD_FINANCE_ENVIRONMENT:'sandbox',FINANCE_SIMULATOR_KEY:'synthetic-model-settlement'};
// Consumes only caller-supplied actual reviewed service rows. No replacement intake,
// employment, timesheet, payout or document rows are seeded by this helper.
export async function settleActualModelSources({x,client,people,maker,checker}){
 const db=x.db,database=x.database,workspace='sbx-model-settlement',provider=new DeterministicFinanceProvider();let n=0;
 const members=[{userId:maker.userId,role:'preparer'},{userId:checker.userId,role:'reviewer'},{userId:client.userId,role:'client'},...people.map(p=>({userId:p.actor.userId,role:'officer'}))];
 await createFinanceWorkspace(db,{...maker,owner:true},runtime,workspace,FINANCE_SANDBOX_POLICY,members.map(m=>({...m,limit:100000000})));
 const run=async input=>{const p=await prepareFinanceCommand(db,maker,runtime,workspace,input,'actual-model-'+(++n));return applyFinanceCommand(db,checker,runtime,workspace,p.commandId,p.digest,'approved','Independent synthetic actual-service settlement review');};
 const record=id=>JSON.parse(database.prepare('SELECT data_json FROM finance_current_records WHERE workspace_id=? AND id=?').get(workspace,id).data_json);
 const balance=account=>database.prepare('SELECT balance FROM finance_balances WHERE workspace_id=? AND account=?').get(workspace,account)?.balance??0;
 async function settle(id,recover=false){await dispatchFinanceOperation(db,maker,runtime,workspace,id,provider,recover);const e=provider.result(record(id)),eventId='actual-model-event-'+(++n),raw=JSON.stringify({workspace,operationId:id,eventId,evidence:e});await acceptFinanceWebhook(db,runtime,raw,await financeSignature(raw,runtime.FINANCE_SIMULATOR_KEY));await attestFinanceBank(db,checker,runtime,workspace,id,'bank:'+eventId,e);await run({action:'reconcile_operation',operationId:id});}
 const sources=people.map(p=>({person:p,source:database.prepare('SELECT * FROM shift_timesheets WHERE shift_id=?').get(p.shiftId)}));assert.ok(sources.every(s=>s.source.operations_status==='approved_for_backend'));const snapshots=sources.map(s=>JSON.stringify(s.source));
 const bookingId=sources[0].source.booking_id,total=database.prepare('SELECT client_price_cents FROM bookings WHERE id=?').get(bookingId).client_price_cents;assert.ok(sources.every(s=>s.source.booking_id===bookingId));
 await run({action:'open_order',id:'model-order',bookingId,clientUser:client.userId});await run({action:'prepare_collection',id:'model-collection',orderId:'model-order',amount:total});await settle('model-collection');
 for(const [i,{person,source}] of sources.entries()){
  const partner=source.workforce_model==='partner',recipient=partner?client:person.actor,id='model-payroll-'+i;
  if(partner)await run({action:'approve_company_recipient',companyId:source.employer_id,ownerUser:client.userId,reference:'sandbox:independently-confirmed-company-recipient'});
  const calculated=await run({action:partner?'recognize_partner_invoice':'recognize_payroll',id,orderId:'model-order',ownerUser:recipient.userId,sources:[{id:source.id}]});const liabilityId=calculated.liabilities[0];
  if(partner)await run({action:'correct_partner_invoice',payrollId:id,segments:[{id:liabilityId,gross:source.gross_wage_cents+1000}],reason:'Fictional independently reviewed actual partner invoice line adjustment'});
  const l=record(liabilityId),amount=l.net,tax=l.tax+l.deduction+l.levy;await run({action:'allocate_funds',orderId:'model-order',companyId:l.company,amount:amount+tax});
  await run({action:'approve_destination',id:'model-destination-'+i,ownerUser:recipient.userId,recipientCode:'SIM-MODEL-'+i,...(partner?{companyId:l.company}:{})});
  const first=Math.floor(amount/2);await run({action:'prepare_payout',id:'model-part-'+i,liabilityId,destinationId:'model-destination-'+i,amount:first});await settle('model-part-'+i);assert.equal(balance('liability:'+liabilityId),amount-first);
  await run({action:'prepare_payout',id:'model-rest-'+i,liabilityId,destinationId:'model-destination-'+i,amount:amount-first});provider.timeout=true;await dispatchFinanceOperation(db,maker,runtime,workspace,'model-rest-'+i,provider);provider.timeout=false;await settle('model-rest-'+i,true);assert.equal(provider.calls.filter(c=>c.method==='POST'&&c.reference===record('model-rest-'+i).reference).length,1);
  if(tax){await run({action:'approve_destination',id:'model-tax-destination-'+i,ownerUser:recipient.userId,recipientCode:'SIM-TAX-'+i,purpose:'tax'});await run({action:'prepare_tax_payout',id:'model-tax-'+i,liabilityId,destinationId:'model-tax-destination-'+i,amount:tax});await settle('model-tax-'+i);}
  assert.equal(balance('liability:'+liabilityId),0);assert.equal(balance('tax:'+liabilityId),0);
  const document='statement:'+id+(partner?':correction:1':'');assert.equal((await readFinanceJourney(db,recipient,runtime,workspace,document)).records[0].financialState,'paid');await assert.rejects(readFinanceJourney(db,{...recipient,userId:'unrelated-model-recipient'},runtime,workspace,document));
  assert.equal(record(id).sources[0],source.id);assert.equal(JSON.stringify(database.prepare('SELECT * FROM shift_timesheets WHERE id=?').get(source.id)),snapshots[i]);
 }
 assert.equal(database.prepare('SELECT sum(balance) n FROM finance_balances WHERE workspace_id=?').get(workspace).n,0);assert.equal(x.runtime.DB.sql.prepare('SELECT count(*) n FROM finance_records').get().n,0);
 return {workspace,sourceCount:sources.length};
}
export async function settleActualCompanySplits({finance,liabilities,client,applicant}){
 const total=finance.database.prepare('SELECT client_price_cents FROM bookings WHERE id=?').get(finance.record('period-order').bookingId).client_price_cents;
 await finance.run({action:'prepare_collection',id:'split-collection',orderId:'period-order',amount:total});await finance.settle('split-collection');await finance.run({action:'approve_destination',id:'split-dest',ownerUser:applicant.userId,recipientCode:'SIM-SPLIT-EMPLOYEE'});await finance.run({action:'approve_destination',id:'split-tax-dest',ownerUser:applicant.userId,recipientCode:'SIM-SPLIT-TAX',purpose:'tax'});
 for(const [i,l] of liabilities.entries()){const id='period-payroll:'+i,tax=l.tax+l.deduction+l.levy;await finance.run({action:'allocate_funds',orderId:'period-order',companyId:l.company,amount:l.net+tax});await finance.run({action:'prepare_payout',id:'split-first-'+i,liabilityId:id,destinationId:'split-dest',amount:Math.floor(l.net/2)});await finance.settle('split-first-'+i);assert.equal(finance.balance('liability:'+id),l.net-Math.floor(l.net/2));await finance.run({action:'prepare_payout',id:'split-last-'+i,liabilityId:id,destinationId:'split-dest',amount:l.net-Math.floor(l.net/2)});await finance.settle('split-last-'+i);if(tax){await finance.run({action:'prepare_tax_payout',id:'split-tax-'+i,liabilityId:id,destinationId:'split-tax-dest',amount:tax});await finance.settle('split-tax-'+i);}assert.equal(finance.balance('liability:'+id),0);assert.equal(finance.balance('tax:'+id),0);}
 const {workspace}=await import('./finance-workflow-db.mjs');assert.equal((await readFinanceJourney(finance.db,applicant,runtime,workspace,'statement:period-payroll')).records[0].financialState,'paid');await assert.rejects(readFinanceJourney(finance.db,client,runtime,workspace,'statement:period-payroll'));assert.equal(finance.database.prepare('SELECT sum(balance) n FROM finance_balances').get().n,0);
}
