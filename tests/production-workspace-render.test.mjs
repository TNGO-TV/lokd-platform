import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import * as signup from '../app/lib/signup-types.ts';
import * as psira from '../app/lib/psira-pathway.ts';
import {testSurfacesEnabled} from '../app/lib/test-surface-policy.ts';
import * as contracts from '../app/lib/workspace-response-contracts.ts';
import * as receipts from '../app/lib/workspace-command-receipt.ts';
import * as publicSite from '../app/lib/public-site.ts';

const link=({children,...props})=>{delete props.prefetch;return React.createElement('a',props,children);};
const image=props=>{const attributes={...props};delete attributes.unoptimized;return React.createElement('img',attributes);};
function load(name,modules,extra='') {
 const source=fs.readFileSync(new URL('../app/components/'+name,import.meta.url),'utf8')+extra;
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,Intl,URL,URLSearchParams,require:key=>{
  if(key.endsWith('.css'))return {default:{}};
  assert.ok(key in modules,key);return modules[key];
 }});
 return exports;
}
const modules={react:React,'react/jsx-runtime':jsx,'next/link':{default:link},'next/image':{default:image},'next/navigation':{usePathname:()=>'/officer',useSearchParams:()=>new URLSearchParams()},'../lib/signup-types':signup,'../lib/psira-pathway':psira};
modules['../lib/workspace-response-contracts']=contracts;modules['../lib/workspace-command-receipt']=receipts;modules['./workspace-request']=load('workspace-request.tsx',modules);
modules['./test-surface-context']=load('test-surface-context.tsx',modules);
modules['./test-agreement-panel']={default:()=>React.createElement('div',{'data-rehearsal-agreement':'true'},'Test agreement fixture')};
modules['./officer-presence-panel']=load('officer-presence-panel.tsx',modules);
const Shell=load('workspace-shell.tsx',modules).default;
const Card=load('signup-portal.tsx',modules,'\nexport {RecordCard};').RecordCard;

test('production finance screens retain live controls while hiding mixed test records before parsing their payloads',()=>{
 const financeModules={...modules,'./payment-recovery-controls':{default:()=>null},'./action-confirmation':{default:({label})=>React.createElement('button',null,label)}};
 const snapshot={officerId:'live-officer',employerId:'live-employer',employerName:'Live company',recipient:{last4:'1234',bankName:'Fixture bank'}};
 const payment={reference:'live-payment',mode:'live',source_json:JSON.stringify(snapshot),amount_cents:100,status:'prepared',providerState:'not_sent',current:true};
 const collection={reference:'live-collection',order_id:'live-order',mode:'live',amount_minor:100,currency:'ZAR',state:'prepared',current:true};
 const review={id:'live-destination',officer_id:'live-officer',employer_id:'live-employer',mode:'live',status:'pending',payload_json:JSON.stringify({sourceJson:JSON.stringify(snapshot),provider:snapshot.recipient})};
 const testRow={id:'hidden-test',reference:'hidden-test',officer_id:'hidden-test',employer_id:'hidden-test',order_id:'hidden-test',mode:'test',payload_json:'invalid JSON',source_json:'invalid JSON'};
 const cases=[
  ['employee-payment-controls.tsx',{employeePaymentAccess:true,employeePaymentCandidates:[testRow,{...payment,payroll_item_id:'live-item',destination_id:'live-destination'}],employeePayments:[testRow,payment]},/Approve payment instruction/],
  ['partner-payment-controls.tsx',{partnerPaymentAccess:true,partnerPaymentCandidates:[testRow,{...payment,payable_id:'live-payable',destination_id:'live-destination'}],partnerPayments:[testRow,payment]},/Approve payment instruction/],
  ['payment-destination-controls.tsx',{destinationAccess:true,destinationCandidates:[],destinationReviews:[testRow,review]},/Verify live destination/],
  ['partner-destination-controls.tsx',{partnerDestinationAccess:true,partnerDestinationCandidates:[],partnerDestinationReviews:[testRow,review]},/Verify live destination/],
  ['booking-collection-controls.tsx',{collections:[testRow,collection]},/Independently approve collection/],
  ['booking-settlement-controls.tsx',{collections:[testRow,collection],collectionRecoveries:[],settlementReviews:[testRow,{id:'live-settlement',reference:'live-collection',mode:'live',settlement_id:'live-settlement',decision:null,payload_json:'{}'}]},/Confirm cleared settlement/],
 ];
 for(const [file,data,action] of cases){
  const Component=load(file,financeModules).default;
  const html=renderToStaticMarkup(React.createElement(Component,{data,operations:true,busy:false,send:async()=>true}));
  assert.doesNotMatch(html,/hidden-test|dispatch_employee_test|dispatch_partner_test|verify_employee_test|verify_partner_test|value="test"/);
  assert.match(html,action,file);
 }
});

test('rendered production workspaces and populated intake cards expose real actions without rehearsal controls',()=>{
 for(const role of ['client','officer','operations'])for(const kind of role==='operations'?['client','officer']:[role]){
  const record={kind,id:'APP-render-fixture',version:2,updatedAt:'2026-10-16T00:00:00Z',details:{fullName:'Officer fixture',organisationName:'Client fixture',pathway:'qualified',psiraStatus:'active'},email:'isolated@example.test',accountLinked:true,status:'reviewed',events:[]};
  const card=React.createElement(Card,{record,operations:role==='operations',busy:false,run:async()=>true,refresh:async()=>true});
  const children=React.createElement(React.Fragment,null,card,role==='officer'?React.createElement(modules['./officer-presence-panel'].default):null);
  const render=testTools=>renderToStaticMarkup(React.createElement(Shell,{role,testTools},children));
  const production=render(false);
  assert.match(production,/Agreements/);assert.match(production,/Service &amp; payments/);
  assert.match(production,/APP-render-fixture/);
  assert.doesNotMatch(production,/Testing tools|Sandbox workflows|test-cycle|payment-test|data-rehearsal-agreement|synthetic test signal|identity\?caseId/);
  if(kind==='officer')assert.match(production,/readiness\?applicantId=APP-render-fixture/);
  if(role==='operations')assert.match(production,/Prepare operational record/);
  const isolated=render(true);
  assert.match(isolated,/Testing tools/);assert.match(isolated,/data-rehearsal-agreement/);
  if(role==='officer'){assert.match(production,/Stop public sharing/);assert.match(isolated,/synthetic test signal/);}
 }
});

test('public legal, contact, footer and organisation metadata use the approved company identity and postal contact',async()=>{
 const legalModules={...modules,'../lib/public-site':publicSite,'next/headers':{headers:async()=>new Headers()},'../components/client-enquiry-form':{default:()=>null}};
 legalModules['./public-site-shell']=load('public-site-shell.tsx',legalModules);
 legalModules['../components/public-site-shell']=legalModules['./public-site-shell'];
 legalModules['../components/legal-document']=load('legal-document.tsx',legalModules);
 for(const page of ['privacy','terms','terms-and-conditions','contact']){
  const loaded=load('../'+page+'/page.tsx',legalModules);
  const html=renderToStaticMarkup(React.createElement(loaded.default));
  assert.match(html,/Lokd Security \(Pty\) Ltd/);assert.match(html,/71 Louis Trichardt Street, Pretoria, 0002/);
  assert.doesNotMatch(html+JSON.stringify(loaded.metadata),/Tactical Nation|tacticalnation|Custom Nation|Tervory|Shot Bonus|Sister brands|Parktown Estates/);
  assert.doesNotMatch(html,/mailto:71 Louis/);
 }
 const jsonLd=load('seo-json-ld.tsx',legalModules);
 const html=renderToStaticMarkup(await jsonLd.OrganisationJsonLd());
 assert.match(html,/"legalName":"Lokd Security \(Pty\) Ltd"/);assert.match(html,/"streetAddress":"71 Louis Trichardt Street"/);
 assert.doesNotMatch(html,/verified officers|Parktown Estates|Tactical Nation/);
});

test('root layout renders feedback only on explicitly enabled test hosts and metadata makes no verification claim',async()=>{
 for(const host of ['lokd.co.za','officers.lokd.co.za','clients.lokd.co.za','operations.lokd.co.za','demo.lokd.co.za'])for(const stage of ['production','prelaunch','demo'])for(const flag of ['true','false']){
  const runtime={LOKD_APP_STAGE:stage,LOKD_TEST_SURFACES_ENABLED:flag};
  const rootModules={...modules,'next/headers':{headers:async()=>new Headers({host})},'cloudflare:workers':{env:runtime},'./components/clerk-login':{LokdClerkProvider:({children})=>children},'./lokd-auth':{getLokdUser:async()=>({id:'synthetic-user'})},'./components/pilot-feedback':{default:()=>React.createElement('div',{'data-feedback':'true'},'Feedback fixture')},'./components/seo-json-ld':{OrganisationJsonLd:()=>null},'./lib/public-site':{PUBLIC_SITE_URL:'https://lokd.co.za'},'./test-surface-policy':{testSurfacesEnabled},'next/navigation':{notFound:()=>{throw Error('not found');}}};
  rootModules['./lib/test-surface-page']=load('../lib/test-surface-page.ts',rootModules);
  const root=load('../layout.tsx',rootModules);
  const html=renderToStaticMarkup(await root.default({children:React.createElement('main',null,'Production content')}));
  assert.equal(html.includes('data-feedback'),host==='demo.lokd.co.za'&&stage!=='production'&&flag==='true',`${host}/${stage}/${flag}`);
  assert.doesNotMatch(JSON.stringify(root.metadata),/verified officers/i);
 }
});
