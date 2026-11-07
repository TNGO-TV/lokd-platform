import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as models from '../app/lib/booking-models.ts';
import * as contracts from '../app/lib/workspace-response-contracts.ts';

const id='ENQ-11111111-1111-4111-8111-111111111111';
const row={id,organisationName:'Private organisation',contactName:'Booking Contact',email:'booking@example.test',mobile:'+27821234567',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'within_30_days',serviceType:'scheduled_unarmed_fixed_site',message:'Access control',status:'new',ownerId:null,resolution:null,createdAt:'2026-11-07T00:00:00Z',updatedAt:'2026-11-07T00:00:00Z',version:1,engagementModel:'bolt',noticeWindow:'urgent',calendarType:'ordinary',riskBand:'Standard',bookingDetails:'{"term":"single"}',internalDraftPrice:'{"totalCents":280000,"version":"current"}',siteAddress:'24 Rivonia Road',startDate:'2026-11-08',endDate:'2026-11-08',startTime:'06:00',endTime:'18:00',officers:2,schedule:'Single shift'};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function setup(respond){
 const slots=[],calls=[];let cursor=0,tree;
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},'./signup-portal.module.css':{default:{}},'next/navigation':{usePathname:()=>'/ops/intake',useSearchParams:()=>new URLSearchParams()},react:{useState:initial=>{const key=cursor++;if(!(key in slots))slots[key]=initial;return [slots[key],value=>{slots[key]=value;}];}},'../lib/booking-models':models,'../lib/workspace-response-contracts':contracts};
 const load=name=>{const exports={};const code=ts.transpileModule(fs.readFileSync(new URL('../app/components/'+name,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,Intl,Error,TypeError,fetch:async(url)=>{calls.push(url);return respond();},require:key=>{assert.ok(key in modules,key);return modules[key];}});return exports;};
 modules['./workspace-request']=load('workspace-request.tsx');const Component=load('booking-enquiry-detail.tsx').OperationsBookingEnquiryDetail;
 const render=()=>{cursor=0;tree=Component({id});};
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match;}return null;}
 function text(node){if(node==null||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);if(Array.isArray(node))return node.map(text).join(' ');if(typeof node.type==='function')return text(node.type(node.props));return text(node.props?.children);}
 return {calls,async load(){render();find(tree,n=>n.type==='button').props.onClick();await flush();},text(){render();return text(tree);}};
}

test('Operations loads one selected enquiry on demand and clears its draft after access loss',async()=>{
 let response=()=>Response.json({enquiries:[row]});const ui=setup(()=>response());
 assert.equal(ui.calls.length,0);assert.doesNotMatch(ui.text(),/2[\s\u00a0]*800/);
 await ui.load();assert.deepEqual(ui.calls,['/api/enquiries?id='+id]);assert.match(ui.text(),/Internal draft price:\s*R[\s\u00a0]*2[\s\u00a0]*800/);assert.match(ui.text(),/LOKD Bolt/);
 response=()=>Response.json({error:'Operations access required'},{status:403});await ui.load();assert.doesNotMatch(ui.text(),/2[\s\u00a0]*800|24 Rivonia Road/);
});

test('the detail cannot display another enquiry or malformed pricing metadata',async()=>{
 for(const changed of [{id:'another-enquiry'},{noticeWindow:{}},{officers:'two'}]){
  const ui=setup(()=>Response.json({enquiries:[{...row,...changed}]}));await ui.load();assert.doesNotMatch(ui.text(),/Internal draft price:\s*R/);
 }
 const ui=setup(()=>Response.json({enquiries:[{...row,internalDraftPrice:'{"totalCents":"280000"}'}]}));await ui.load();assert.match(ui.text(),/Pricing review required/);assert.doesNotMatch(ui.text(),/NaN/);
});
