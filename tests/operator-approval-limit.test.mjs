import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
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
 const database=new DatabaseSync(':memory:');
 database.exec(`CREATE TABLE operator_accounts(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,status TEXT,approval_limit_cents INTEGER,environment TEXT,integrity_state TEXT,created_at TEXT,updated_at TEXT,version INTEGER DEFAULT 1);
 CREATE TABLE operator_role_assignments(id TEXT,operator_id TEXT,role TEXT,status TEXT,environment TEXT,integrity_state TEXT,granted_by TEXT,granted_at TEXT,revoked_at TEXT,UNIQUE(operator_id,role,environment));
 CREATE TABLE audit_events(id TEXT,actor_type TEXT,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT);`);
 const db={prepare(sql){const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>database.prepare(sql).run(...values)});return make();},async batch(statements){database.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());database.exec('COMMIT');return r;}catch(e){database.exec('ROLLBACK');throw e;}}};
 const owner={userId:'test-owner',email:'owner@example.test',operations:true,owner:true};
 const headers=new Headers({'x-lokd-verified-user-id':owner.userId,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()});
 const input={action:'grant_operator',email:owner.email,role:'finance_approver',noPersonalCap:true};
 try{
  await assert.rejects(()=>operateProduction(db,{...owner,owner:false},input,headers),/assigned Operations owner/);
  const grant=await operateProduction(db,owner,input,headers);
  assert.equal(database.prepare('SELECT approval_limit_cents FROM operator_accounts').get().approval_limit_cents,NO_PERSONAL_APPROVAL_CAP);
  assert.equal(JSON.parse(database.prepare('SELECT details FROM audit_events').get().details).noPersonalCap,true);
  assert.equal((await productionOperatorControl(db,owner,headers,'payment.approve',25_000_000,'different-maker')).id,grant.operatorId);
  await assert.rejects(()=>productionOperatorControl(db,owner,headers,'payment.approve',25_000_001,'different-maker'),/policy limit/);
  await assert.rejects(()=>productionOperatorControl(db,owner,headers,'payment.approve',1,grant.operatorId),/maker/);
  await assert.rejects(()=>productionOperatorControl(db,owner,headers,'funding.verify',0),/role is required/);
  await operateProduction(db,owner,{action:'grant_operator',email:owner.email,role:'finance_approver',limitCents:0},headers);
  await assert.rejects(()=>productionOperatorControl(db,owner,headers,'payment.approve',1,'different-maker'),/approved limit/);
  assert.equal(database.prepare('SELECT count(*) AS n FROM operator_accounts').get().n,1);
 }finally{database.close();}
});
