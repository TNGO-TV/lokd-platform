import test from 'node:test';
import assert from 'node:assert/strict';
import {env} from 'cloudflare:workers';
import {prepareConnectedScenario} from './integrated-browser/connected-scenarios.mjs';
import {POST} from '../app/api/sandbox/application/route.ts';
import {sandboxServiceResponse} from '../app/lib/workspace-response-contracts.ts';
import {workspaceContracts} from '../app/lib/workspace-contracts-generated.ts';

test('actual isolated service responses validate before UI composition and reject missing required fields',async()=>{
 const x=await prepareConnectedScenario('service'),roles=x.roles;
 try{
  Object.assign(env,x.runtime,{LOKD_OPERATIONS_MFA_REQUIRED:'false',LOKD_PILOT_ACCESS_JSON:JSON.stringify({owners:[roles.checker.email,roles.independent.email],operations:[roles.maker.email,roles.assessor.email]})});
  for(const actor of [roles.officer,roles.maker,roles.checker]){
   for(const [service,key] of [['schedule_read','sandboxSchedule'],['service_read','sandboxService'],['orders_read','sandboxOrders'],['operations_read','sandboxOperations']]){
    const response=await POST(new Request('https://demo.lokd.co.za/api/sandbox/application',{method:'POST',headers:{origin:'https://demo.lokd.co.za','content-type':'application/json','x-lokd-verified-user-id':actor.userId,'x-lokd-verified-email':actor.email},body:JSON.stringify({service,input:{}})}));
    assert.equal(response.status,200,await response.clone().text());const body=await response.json();
    assert.equal(sandboxServiceResponse(body,service),true,service+' '+actor.userId);
    const required=Object.keys(workspaceContracts[key].fields).find(k=>!workspaceContracts[key].fields[k].optional);
    const malformed=structuredClone(body);delete malformed.data[required];
    assert.equal(sandboxServiceResponse(malformed,service),false,service+' missing '+required);
    assert.equal(sandboxServiceResponse({...body,productionWorkEligible:true},service),false);
   }
  }
  assert.equal(x.primaryDatabase.prepare('SELECT count(*) AS n FROM officer_applications').get().n,0);
 }finally{x.close();}
});
