import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';

const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
const kind=process.env.LOKD_ACCOUNT_TEST_PARTNER_PAYMENTS==='true'?'partner':'employee';
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){
 await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});
 await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});
}

test('authenticated recovery requires independent finance and only prepares one linked replacement',async({browser})=>{
 test.skip(process.env.LOKD_ACCOUNT_TEST_RECOVERY!=='true','Requires isolated terminal-evidence fixture.');
 test.setTimeout(180000);
 expect(process.env.LOKD_ACCOUNT_TEST_STAGE).toBe('production');
 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
 try{
  const [maker,finance,client,officer]=await Promise.all(contexts.map(c=>c.newPage()));
  await login(maker,'operations');await login(finance,kind==='partner'?'owner':'finance');
  await login(client,'client');await login(officer,'officer');
  const endpoint='/api/production-operations?kind=client&scope=operations';
  const state=await(await maker.request.get(endpoint)).json();
  const payments=state[kind==='employee'?'employeePayments':'partnerPayments'];
  const original=payments.find(i=>i.status==='dispatch_claimed'&&i.recovery?.terminal?.disposition==='failed');
  expect(original).toBeTruthy();expect(original.mode).toBe('test');
  const terminal=original.recovery.terminal;
  const command={kind,action:'propose_test_disposition',reference:original.reference,version:original.version,
   sourceHash:original.source_hash,evidenceId:terminal.evidence_id,disposition:terminal.disposition,
   evidenceReviewed:true,note:'Local authenticated QA reviewed the exact synthetic terminal evidence.'};
  const send=(page,data)=>page.request.post('/api/payment-recovery',{data});
  for(const page of [client,officer])expect((await send(page,command)).status()).toBe(403);
  expect((await send(maker,{...command,version:original.version+1})).status()).toBe(409);
  expect((await send(maker,{...command,evidenceId:'invented-terminal-evidence'})).status()).toBe(409);
  expect((await send(maker,{...command,evidenceReviewed:false})).status()).toBe(400);
  const proposed=await send(maker,command);expect(proposed.status()).toBe(200);
  const proposal=await proposed.json();expect(proposal.paymentReleased).toBe(false);
  const approval={...command,action:'approve_test_disposition',proposalId:proposal.proposalId};
  expect((await send(maker,approval)).status()).toBe(403);
  expect((await send(finance,{...approval,evidenceId:'wrong-terminal-evidence'})).status()).toBe(409);
  const approved=await send(finance,approval);expect(approved.status()).toBe(200);
  const decision=await approved.json();expect(decision.paymentReleased).toBe(false);
  expect((await send(finance,approval)).status()).toBe(409);

  const after=await(await finance.request.get(endpoint)).json();
  const unchanged=after[kind==='employee'?'employeePayments':'partnerPayments'].find(i=>i.reference===original.reference);
  expect(unchanged.active_key).toBe(original.active_key);expect(unchanged.status).toBe('dispatch_claimed');
  const input={action:`prepare_${kind}_payment`,requestKey:`browser-${kind}-recovery`,
   ...(kind==='employee'?{payrollItemId:original.payroll_item_id}:{payableId:original.payable_id}),
   destinationId:original.destination_id,replacesReference:original.reference,recoveryApprovalId:decision.approvalId,
   instructionReviewed:true,note:'Local QA replacement preparation only; no dispatch.'};
  const replacement=await maker.request.post(endpoint,{data:input});expect(replacement.status()).toBe(200);
  const child=(await replacement.json()).result;expect(child.reference).toEqual(expect.any(String));expect(child.reference).not.toBe(original.reference);
  const retry=await maker.request.post(endpoint,{data:input});expect(retry.status()).toBe(200);
  expect((await retry.json()).result.reference).toBe(child.reference);
  expect((await maker.request.post(endpoint,{data:{...input,requestKey:'second-browser-replacement'}})).status()).toBe(409);

  // Inspect only the isolated local database. Never submit a dispatch action.
  const directory='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
  const files=readdirSync(directory).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');expect(files).toHaveLength(1);
  const db=new DatabaseSync(directory+'/'+files[0],{readOnly:true});
  try{
   const saved=db.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(child.reference);
   expect(saved.status).toBe('prepared');expect(saved.mode).toBe('test');expect(saved.source_hash).toBe(original.source_hash);
   expect(db.prepare(`SELECT count(*) n FROM ${kind}_payment_commands WHERE action='dispatch_test'`).get().n).toBe(1);
   expect(db.prepare(`SELECT count(*) n FROM ${kind}_recovery_replacements`).get().n).toBe(1);
   expect(db.prepare('SELECT count(*) n FROM disbursement_items').get().n).toBe(0);
  }finally{db.close();}
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
});
