import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import {workspaceContracts} from '../app/lib/workspace-contracts-generated.ts';
import * as contracts from '../app/lib/workspace-response-contracts.ts';
import * as receipts from '../app/lib/workspace-command-receipt.ts';

// Valid empty fixture; populated/owned reads are exercised by SQLite journeys.
function empty(){return Object.fromEntries(Object.entries(workspaceContracts.operations.fields).filter(([,field])=>!field.optional).map(([name,field])=>[name,['array','intersection'].includes(field.schema.kind)?[]:false]));}
function load(file,modules,globals={},extra=''){
 const source=fs.readFileSync(new URL('../app/components/'+file,import.meta.url),'utf8')+extra;
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 vm.runInNewContext(code,{exports,Error,TypeError,Response,crypto,TextEncoder,URLSearchParams,AbortController,setTimeout,clearTimeout,...globals,require:key=>key.endsWith('.css')?{default:{}}:modules[key]??{default:key}});
 return exports;
}
function fixture(respond){
 const slots=[],callbacks=[],calls=[];let index=0,tree;
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},react:{useEffect:()=>{},useCallback:fn=>{callbacks.push(fn);return fn;},useRef:initial=>slots[index++]??={current:initial},useState:initial=>{const key=index++;if(!(key in slots))slots[key]=initial;return [slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value;}];}},'../lib/workspace-response-contracts':contracts,'../lib/workspace-command-receipt':receipts};
 modules['./workspace-request']=load('workspace-request.tsx',modules);
 const Panel=load('production-operations-panel.tsx',modules,{fetch:async(url,options)=>{calls.push({url,options});return respond(url,options);}}).default;
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
 const render=()=>{index=0;callbacks.length=0;tree=Panel({kind:'client',operations:true});while(typeof tree?.type==='function')tree=tree.type(tree.props);};render();
 return {calls,render,load:()=>callbacks[0](),find:predicate=>find(tree,predicate),command:body=>{render();return find(tree,node=>node.type==='./production-service-controls').props.send(body);}};
}
test('production response contracts reject generic success, wrong endpoints, incomplete rows and invalid saved JSON',()=>{
 const state=empty();assert.equal(contracts.productionOperationsResponse(state),true);
 for(const invalid of [{},null,[],{saved:true}, {...state,rosters:[{}]}, {...state,collections:[{mode:'test'}]}, {...state,payrollRuns:[{payload_json:'null'}]}])assert.equal(contracts.productionOperationsResponse(invalid),false);
 for(const key of Object.keys(state)){const missing={...state};delete missing[key];assert.equal(contracts.productionOperationsResponse(missing),false,key);}
 assert.equal(contracts.productionSigningResponse(state),false);assert.equal(contracts.clientQuotesResponse(state),false);
});
test('command receipts bind endpoint, action and exact submitted references without treating generic success as completion',async()=>{
 const body={action:'approve_activation',activationKey:'A'},value={commandReceipt:await receipts.workspaceCommandReceipt('production-operations',body)};
 assert.equal(await receipts.matchesWorkspaceCommand(value,'production-operations',body),true);
 for(const [kind,input] of [['finance-documents',body],['production-operations',{...body,activationKey:'B'}],['production-operations',{...body,action:'revoke_operator'}]])assert.equal(await receipts.matchesWorkspaceCommand(value,kind,input),false);
 for(const invalid of [null,{},[],{saved:true}, {commandReceipt:{version:1,kind:'production-operations',action:body.action}}])assert.equal(await receipts.matchesWorkspaceCommand(invalid,'production-operations',body),false);
});
test('actual Operations handlers retain stale drafts with actions disabled and require matching write receipts',async()=>{
 let response=empty();const ui=fixture(async()=>Response.json(response));await ui.load();ui.render();assert.ok(ui.find(node=>node.type==='./production-service-controls'));
 response={};await ui.load();ui.render();assert.equal(ui.find(node=>node.type==='./production-service-controls').props.busy,true);
 const callsBefore=ui.calls.length;assert.equal(await ui.command({action:'approve_activation',activationKey:'A'}),false);assert.equal(ui.calls.length,callsBefore);
 const evaluate=ui.find(node=>node.type==='button'&&node.props.value==='evaluate');assert.equal(evaluate.props.disabled,true);
 response=empty();await ui.load();ui.render();
 response={...empty(),saved:true};assert.equal(await ui.command({action:'approve_activation',activationKey:'A'}),false);ui.render();assert.equal(ui.find(node=>node.type==='./production-service-controls').props.busy,true);
 response=empty();await ui.load();ui.render();
 const body={action:'approve_activation',activationKey:'A'};
 response={...empty(),commandReceipt:await receipts.workspaceCommandReceipt('production-operations',body)};
 assert.equal(await ui.command(body),true);
});
test('a verified command followed by unreadable records reports confirmed command with stale actions disabled',async()=>{
 const body={action:'prepare_document',sourceId:'payroll-A'};let failRead=false;
 const ui=fixture(async(_url,options)=>options?.method==='POST'?(failRead=true,Response.json({documentId:'FD-fixture',commandReceipt:await receipts.workspaceCommandReceipt('finance-documents',body)})):Response.json(failRead?{}:empty()));
 await ui.load();ui.render();await assert.rejects(()=>ui.command(body),/does not match these records/);ui.render();
 assert.equal(ui.find(node=>node.type==='./production-service-controls').props.busy,true);
 assert.ok(ui.find(node=>typeof node.props?.message==='string'&&node.props.message.includes('server confirmed this command')));
});
test('authorization loss clears the protected records rather than retaining a stale private view',async()=>{
 let status=200;const ui=fixture(async()=>Response.json(status===200?empty():{error:'Access denied'},{status}));
 await ui.load();ui.render();assert.ok(ui.find(node=>node.type==='./production-service-controls'));
 status=403;await ui.load();ui.render();assert.equal(ui.find(node=>node.type==='./production-service-controls'),null);
 assert.ok(ui.find(node=>typeof node.props?.message==='string'&&node.props.message.includes('Access denied')));
});
test('identity application picker rejects incomplete nested cases, retains stale inert rows, and clears them on access loss',async()=>{
 const slots=[],selected=[];let index=0,tree,denied=0,status=200;
 let payload={cases:[{applicantId:'APP-1',fullName:'Fixture Officer',city:'Pretoria',intakeStatus:'reviewed'}],nextOffset:null};
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},'../lib/workspace-response-contracts':contracts,react:{useRef:initial=>slots[index++]??={current:initial},useState:initial=>{const key=index++;if(!(key in slots))slots[key]=initial;return [slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value;}];}}};
 modules['./workspace-request']=load('workspace-request.tsx',modules);
 const Picker=load('identity-case-picker.tsx',modules,{fetch:async()=>Response.json(payload,{status})}).default;
 const render=()=>{index=0;tree=Picker({operations:true,onSelect:value=>selected.push(value),onAccessLost:()=>denied++});};
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
 const flush=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);render();};
 const refresh=async()=>{render();find(tree,node=>node.type==='button'&&node.props.children==='Load available applications').props.onClick();await flush();};
 await refresh();assert.ok(find(tree,node=>node.type==='li'));
 payload={cases:[{applicantId:'APP-bad',fullName:'Incomplete',city:'Pretoria'}],nextOffset:null};
 await refresh();const stale=find(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children[0]==='Open application ');assert.equal(stale.props.disabled,true);assert.equal(selected.length,0);
 payload={cases:[],nextOffset:null};await refresh();assert.equal(find(tree,node=>node.type==='li'),null);
 payload={cases:[{applicantId:'APP-1',fullName:'Fixture Officer',city:'Pretoria',intakeStatus:'reviewed'}],nextOffset:null};await refresh();
 status=403;payload={error:'Access denied'};await refresh();assert.equal(find(tree,node=>node.type==='li'),null);assert.equal(denied,1);
});

test('protected review and readiness responses must bind the requested record and nested attribution shape',()=>{
 const identity={id:'ID-1',applicantId:'APP-1',applicantVersion:1,outcome:'pending',outcomeId:'OUT-1',identityVerified:false,workEligible:false};
 assert.equal(contracts.readinessRecordResponse(identity,'identity','ID-1'),true);
 assert.equal(contracts.readinessRecordResponse(identity,'identity','ID-2'),false);
 assert.equal(contracts.readinessRecordResponse({officerId:'OFF-1',reviews:[]},'readiness','OFF-1'),false);
 const holds={contract:'lokd.identity-workspace.v1',applicantId:'APP-1',holds:[{kind:'identity',hold_id:'H-1',held_at:'2026-10-16',held_by:'system',attribution:'linked_human_action',humanAudit:[{actorId:'OPS-1',recordedAt:'2026-10-16',auditEventId:'AUD-1',detail:{reason:'Independent investigation'}}]}],nextOffset:null,workEligible:false};
 const query=new URLSearchParams('kind=holds&id=APP-1');assert.equal(contracts.identityReviewResponse(holds,query),true);
 assert.equal(contracts.identityReviewResponse({...holds,applicantId:'APP-2'},query),false);
 assert.equal(contracts.identityReviewResponse({...holds,holds:[{kind:42}]},query),false);
 assert.equal(contracts.identityReviewResponse({...holds,holds:[{humanAudit:{actorId:'OPS-1'}}]},query),false);
 const jsx=(type,props)=>({type,props}),Hold=load('hold-audit.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx}}).default;
 const rendered=JSON.stringify(Hold({response:holds}));assert.match(rendered,/OPS-1/);assert.match(rendered,/Independent investigation/);
});
test('private sandbox reads reject unrelated success and bind command, operation and application references',()=>{
 for(const query of ['commands','commandId=C-1','operationId=OP-1','applicationId=APP-1','catalogue=training','id=DOC-1'])assert.equal(contracts.financePrivateResponse({environment:'sandbox'},new URLSearchParams(query)),false);
 const data={environment:'sandbox',applicationId:'APP-1',applicationVersion:1,enrolmentPaid:false,training:[],workEligible:false};assert.equal(contracts.financePrivateResponse(data,new URLSearchParams('applicationId=APP-1')),true);assert.equal(contracts.financePrivateResponse(data,new URLSearchParams('applicationId=APP-2')),false);
 assert.equal(contracts.sandboxServiceResponse({mode:'sandbox',policyVersion:'lokd-sandbox-completion-v1',productionWorkEligible:false,data:{}},'schedule_read'),false);
});

test('finance document history validates serialized array entries before rendering and preserves historical test evidence',()=>{
 const source={kind:'invoice',source_id:'INV-1',party_id:'CLIENT-1',recipient_user:'USER-1',amount_cents:100,source_json:'{}',financial_json:'[]',currentState:'unpaid'};
 const document={...source,id:'FD-1',version:1,payload_hash:'a'.repeat(64),parent_id:null,decision:'approved',number:'INV-1',source:{},note:'Issued history',asIssuedState:'unpaid',sourceChanged:false,superseded:false,issued_at:'2026-10-16'};
 const data={calendar:'Africa/Johannesburg',documents:[document],sources:[source]};assert.equal(contracts.financeDocumentsResponse(data),true);
 for(const json of ['{}','[null]','[1]','[{}]','[{"reference":"R"}]','[{"reference":1,"mode":"live","state":"paid"}]','null']){assert.equal(contracts.financeDocumentsResponse({...data,documents:[{...document,financial_json:json}]}),false,json);assert.equal(contracts.financeDocumentsResponse({...data,sources:[{...source,financial_json:json}]}),false,json);}
 assert.equal(contracts.financeDocumentsResponse({...data,documents:[{...document,financial_json:JSON.stringify([{reference:'historical-test',mode:'test',state:'paid'}])}]}),true);
});

const sandboxRead=data=>({mode:'simulator',policyVersion:'lokd-sandbox-completion-v1',productionWorkEligible:false,data});
test('passport responses distinguish sandbox envelopes and bind every delivery to the selected officer',()=>{
 const delivery={deliveryId:'PD-1',officerId:'OFF-1',applicantVersion:1,createdAt:'2026-10-16',expiresAt:'2026-10-17',passportId:null,sequence:null,status:'awaiting_preparation',workEligible:false};
 const records={officerId:'OFF-1',deliveries:[delivery],workEligible:false};
 assert.equal(contracts.passportDeliveryResponse(records,'OFF-1'),true);
 assert.equal(contracts.passportDeliveryResponse(sandboxRead(records),'OFF-1',true),true);
 assert.equal(contracts.passportDeliveryResponse(records,'OFF-2'),false);
 assert.equal(contracts.passportDeliveryResponse({...records,deliveries:[{...delivery,officerId:'OFF-2'}]},'OFF-1'),false);
 assert.equal(contracts.passportDeliveryResponse(sandboxRead({...records,deliveries:[{}]}),'OFF-1',true),false);
 assert.equal(contracts.passportDeliveryResponse(delivery,'OFF-1',false,true),true);
 assert.equal(contracts.passportDeliveryResponse({...sandboxRead(delivery),mode:'sandbox'},'OFF-1',true,true),true);
 assert.equal(contracts.passportDeliveryResponse(sandboxRead(delivery),'OFF-1',true,true),false);
 const queue={contract:'lokd.identity-workspace.v1',recordType:'rule',records:[{id:'RULE-1'}],nextOffset:null,workEligible:false};
 const query=new URLSearchParams('kind=queue&recordType=rule');
 assert.equal(contracts.sandboxReviewResponse(sandboxRead(queue),query),true);
 assert.equal(contracts.sandboxReviewResponse(sandboxRead({...queue,recordType:'officer'}),query),false);
 assert.equal(contracts.sandboxReviewResponse(sandboxRead({...queue,nextOffset:0}),query),false);
 assert.equal(contracts.sandboxReviewResponse({data:queue},query),false);
});
test('actual readiness form locks an unconfirmed 2xx command and preserves its draft',async()=>{
 const slots=[];let index=0,calls=0,saved=0;
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},react:{useRef:initial=>slots[index++]??={current:initial},useState:initial=>{const key=index++;if(!(key in slots))slots[key]=initial;return [slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value;}];}},'../lib/workspace-response-contracts':contracts,'../lib/workspace-command-receipt':receipts};
 modules['./workspace-request']=load('workspace-request.tsx',modules);
 const Form=load('readiness-workspace.tsx',modules,{fetch:async()=>{calls++;return Response.json({saved:true});}},'\nexport {ActionForm};').ActionForm;
 const props={title:'Decision',description:'Fixture',action:'decide_officer',fixed:{id:'REVIEW-1'},fields:[],submit:'Save decision',onSaved:async()=>saved++,onDirty:()=>{},onAccessLost:()=>{}};
 const render=()=>{index=0;return Form(props);};
 function find(node,type){if(!node||typeof node!=='object')return null;if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,type);if(found)return found;}return null;}
 await find(render(),'form').props.onSubmit({preventDefault(){}});
 const tree=render();assert.equal(find(tree,'button').props.disabled,true);assert.match(JSON.stringify(tree),/must not be repeated/);assert.equal(saved,0);
 await find(tree,'form').props.onSubmit({preventDefault(){}});assert.equal(calls,1);
});

test('every sandbox readiness branch rejects missing or production-eligible outer envelopes',()=>{
 const cases=[['identity','ID-1',{id:'ID-1',applicantId:'APP-1',applicantVersion:1,outcome:'pending',outcomeId:'OUT-1',identityVerified:false,workEligible:false}],['officer','OFF-1',{officerId:'OFF-1',reviews:[]}],['readiness','OFF-1',{officerId:'OFF-1',reviews:[],optins:[],passport:null,latestSequence:0}],['holds','APP-1',{applicantId:'APP-1',applicantVersion:1,intakeStatus:'reviewed',holds:[]}]];
 for(const [key,id,data] of cases){const valid=sandboxRead(data);assert.equal(contracts.readinessRecordResponse(valid,key,id,true),true,key);assert.equal(contracts.readinessRecordResponse(valid,key,'WRONG',true),false,key);for(const bad of [{data},{...valid,mode:'live'},{...valid,policyVersion:'wrong'},{...valid,productionWorkEligible:true}])assert.equal(contracts.readinessRecordResponse(bad,key,id,true),false,key);}
});

test('signup retains stale inert records, clears denied access and requires an exact write receipt',async()=>{
 const slots=[],callbacks=[],calls=[];let index=0,tree,status=200;
 const record={id:'APP-fixture',kind:'officer',email:'fixture@example.test',createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',accountLinked:false,version:0,status:'received',note:'',details:{fullName:'Synthetic Officer'},events:[]};
 let payload={records:[record],hasMore:false,email:record.email},write={ok:true};
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},'../lib/workspace-response-contracts':contracts,'../lib/workspace-command-receipt':receipts,react:{useCallback:fn=>{callbacks.push(fn);return fn;},useEffect:()=>{},useRef:value=>slots[index++]??={current:value},useState:value=>{const key=index++;if(!(key in slots))slots[key]=value;return [slots[key],next=>{slots[key]=typeof next==='function'?next(slots[key]):next;}];}}};
 modules['./workspace-request']=load('workspace-request.tsx',modules);
 const Panel=load('signup-portal.tsx',modules,{fetch:async(url,options)=>{calls.push({url,options});return Response.json(options?.method==='POST'?write:payload,{status});}},'\nexport {SignupWorkspace};').SignupWorkspace;
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
 const render=()=>{index=0;callbacks.length=0;tree=Panel({kind:'officer',operations:false});};
 const refresh=async()=>{render();await callbacks[1]();render();};
 const card=()=>find(tree,node=>typeof node.type==='function'&&node.type.name==='RecordCard');
 await refresh();assert.equal(card().props.busy,false);
 const valid=payload;payload={...payload,records:[{...record,details:{fullName:{invalid:true}}}]};await refresh();assert.equal(card().props.busy,true);
 const before=calls.length;assert.equal(await card().props.run({action:'link',id:record.id,expectedVersion:0}),false);assert.equal(calls.length,before);
 payload=valid;await refresh();const input={action:'link',id:record.id,expectedVersion:0};
 assert.equal(await card().props.run(input),false);render();assert.equal(card().props.busy,true);
 await refresh();write={ok:true,commandReceipt:await receipts.workspaceCommandReceipt('signup',{...input,kind:'officer'})};
 assert.equal(await card().props.run(input),true);render();assert.equal(card().props.busy,false);
 status=403;payload={error:'Denied'};await refresh();assert.equal(card(),null);
 assert.equal(contracts.signupResponse({...valid,records:[{...record,kind:'client'}]},'officer'),false);
});

test('account-security verification rejects truthy, failed, stale and malformed success while preserving Clerk challenge retry',async()=>{
 const slots=[];let index=0,tree,status=200,payload,challengeCount=0,requests=0;
 const fresh=()=>({fresh:true,enrolled:true,required:true,verifiedAt:new Date().toISOString(),maxAgeMinutes:5});
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},react:{useRef:value=>slots[index++]??={current:value},useState:value=>{const key=index++;if(!(key in slots))slots[key]=value;return [slots[key],next=>{slots[key]=next;}];}},'@clerk/react':{useAuth:()=>({getToken:async()=> 'synthetic',isLoaded:true}),useClerk:()=>({openUserProfile:()=>{}}),useReverification:fn=>async()=>{const result=await fn();if(result?.clerk_error){challengeCount++;status=200;payload=fresh();return fn();}return result;}}};
 const Panel=load('operations-security.tsx',modules,{fetch:async()=>{requests++;return Response.json(payload,{status});}}).default;
 const render=()=>{index=0;tree=Panel({});};
 const children=()=>tree.props.children.flat(Infinity).filter(Boolean);
 const run=async()=>{render();children().find(node=>node.type==='button'&&node.props.children==='Verify second factor').props.onClick();for(let i=0;i<5;i++)await new Promise(setImmediate);render();return children().find(node=>node.props?.role==='status').props.children;};
 for(const invalid of [{fresh:{}},{...fresh(),fresh:'true'},{...fresh(),enrolled:false},{...fresh(),verifiedAt:'invalid'},{...fresh(),verifiedAt:new Date(Date.now()-6*60_000).toISOString()}]){payload=invalid;assert.doesNotMatch(await run(),/^Second factor verified/);}
 status=503;payload=fresh();assert.doesNotMatch(await run(),/^Second factor verified/);
 status=403;payload={clerk_error:{type:'forbidden',reason:'reverification-error',metadata:{reverification:{level:'second_factor',afterMinutes:4}}}};
 assert.match(await run(),/^Second factor verified/);assert.equal(challengeCount,1);
 payload=fresh();render();const button=children().find(node=>node.type==='button'&&node.props.children==='Verify second factor');const before=requests;button.props.onClick();button.props.onClick();for(let i=0;i<5;i++)await new Promise(setImmediate);assert.equal(requests,before+1);
});

test('private passport verification validates every displayed field and retains the no-work-authorisation boundary',()=>{
 const passport={passportNumber:'P-fixture',officerName:'Synthetic Officer',initials:'SO',psiraGrade:'Grade C',psiraCurrent:true,readinessLabel:'Current',status:'active',environment:'production',integrityState:'verified',synthetic:false,productionAuthorized:false,result:'green',message:'Passport current.',lastReviewedAt:null,nextReviewAt:null,endorsements:[],assignment:null,verifiedAt:new Date().toISOString()};
 assert.equal(contracts.publicPassportResponse({passport}),true);
 for(const bad of [{},{...passport,officerName:{}},{...passport,result:'approved'},{...passport,productionAuthorized:true},{...passport,endorsements:[null]}])assert.equal(contracts.publicPassportResponse({passport:bad}),false);
});
