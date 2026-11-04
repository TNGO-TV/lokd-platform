import test from 'node:test';
import assert from 'node:assert/strict';
import {operationsDatabase,addOperator} from './fixtures/operations-db.mjs';
import {operatorApprovalLimit,NO_PERSONAL_APPROVAL_CAP,operatorApprovalLimitLabel} from '../app/lib/operator-approval-limit.ts';
import {operateProduction} from '../app/lib/production-operations.ts';
import {productionOperatorControl} from '../app/lib/production-operator-control.ts';

test('explicit uncapped grants cover representable cents and reject ambiguous or invalid limits',()=>{
 assert.equal(operatorApprovalLimit({noPersonalCap:true}),Number.MAX_SAFE_INTEGER);
 assert.equal(operatorApprovalLimitLabel(NO_PERSONAL_APPROVAL_CAP),'No personal approval cap');
 for(const input of [{},{limitCents:-1},{limitCents:0.5},{limitCents:Infinity},{limitCents:Number.MAX_SAFE_INTEGER+1},{noPersonalCap:'true'},{noPersonalCap:true,limitCents:0}])assert.throws(()=>operatorApprovalLimit(input));
 assert.equal(operatorApprovalLimit({limitCents:0}),0);
 assert.equal(operatorApprovalLimit({noPersonalCap:false,limitCents:100}),100);
});

test('uncapped production grant is owner-only, audited, reversible and retains workflow and independent-review gates',async()=>{
 const {sqlite:database,db}=operationsDatabase();
 const owner={userId:'test-owner',email:'owner@example.test',operations:true,owner:true};
 const headers=addOperator(database,owner.userId,['operations_owner'],100000000,owner.email);
 const finance={userId:'finance-user',email:'finance@example.test',operations:true,owner:false};
 const financeHeaders=new Headers(headers);financeHeaders.set('x-lokd-verified-user-id',finance.userId);financeHeaders.set('x-lokd-verified-email',finance.email);
 const input={action:'grant_operator',email:finance.email,role:'finance_approver',noPersonalCap:true};
 try{
  await assert.rejects(()=>operateProduction(db,{...owner,owner:false},input,headers),/assigned Operations owner/);
  const grant=await operateProduction(db,owner,input,headers);
  assert.equal(database.prepare('SELECT approval_limit_cents FROM operator_accounts WHERE id=?').get(grant.operatorId).approval_limit_cents,NO_PERSONAL_APPROVAL_CAP);
  assert.equal(JSON.parse(database.prepare("SELECT detail FROM audit_events WHERE event_type='production_operator_role_granted'").get().detail).noPersonalCap,true);
  assert.equal((await productionOperatorControl(db,finance,financeHeaders,'payment.approve',25_000_000,'different-maker')).id,grant.operatorId);
  await assert.rejects(()=>productionOperatorControl(db,finance,financeHeaders,'payment.approve',25_000_001,'different-maker'),/policy limit/);
  await assert.rejects(()=>productionOperatorControl(db,finance,financeHeaders,'payment.approve',1,grant.operatorId),/maker/);
  await assert.rejects(()=>productionOperatorControl(db,finance,financeHeaders,'funding.verify',0),/role is required/);
  await operateProduction(db,owner,{action:'grant_operator',email:finance.email,role:'finance_approver',limitCents:0},headers);
  await assert.rejects(()=>productionOperatorControl(db,finance,financeHeaders,'payment.approve',1,'different-maker'),/approved limit/);
  assert.equal(database.prepare('SELECT count(*) AS n FROM operator_accounts').get().n,2);
 }finally{database.close();}
});
