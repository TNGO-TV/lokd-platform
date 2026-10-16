import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../app/components/officer-presence-panel.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const flush=async()=>{for(let i=0;i<3;i++)await new Promise(setImmediate);};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const receipt=body=>body.action==='state'?{mode:'live',revision:1}:body.action==='start'?{mode:'live',consentRevision:2,sessionId:'11111111-1111-4111-8111-111111111111'}:body.action==='share'?{mode:'live',sharing:true,expiresAt:new Date(Date.now()+180000).toISOString()}:{mode:'live',sharing:false};
function setup({pending,stopResponse,holdLocation=false}={}){
 const slots=[],calls=[],effects=[],exports={},jsx=(type,props)=>({type,props});let index=0,tree,tick,locationCallback;
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},'./test-surface-context':{useTestSurface:()=>false},react:{
  useState:value=>{const key=index++;if(!(key in slots))slots[key]=value;return [slots[key],value=>{slots[key]=value;}];},
  useRef:value=>{const key=index++;return slots[key]??=( {current:value} );},
  useEffect:effect=>effects.push(effect),useSyncExternalStore:()=>true,
 }};
 vm.runInNewContext(code,{exports,require:key=>modules[key],Date,Error,Number,fetch:async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(body.action===pending?.action)return pending.promise;
  if(body.action==='stop'&&stopResponse)return stopResponse();
  return Response.json(receipt(body));
 },navigator:{geolocation:{getCurrentPosition:success=>{locationCallback=()=>success({coords:{latitude:-26.176,longitude:28.045}});if(!holdLocation)locationCallback();}}},document:{visibilityState:'visible'},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{}});
 const render=()=>{index=0;effects.length=0;tree=exports.default();};
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
 render();
 return {calls,render,consent(){find(tree,n=>n.type==='input').props.onChange({target:{checked:true}});render();},click(label){find(tree,n=>n.type==='button'&&n.props.children===label).props.onClick();},message(){render();return find(tree,n=>n.props?.role==='status')?.props.children??'';},checkbox(){render();return find(tree,n=>n.type==='input').props;},location(){locationCallback();},startTimer(){render();effects[0]();},tick(){tick();}};
}
const share=ui=>ui.click('Share or refresh live presence');
const stop=ui=>ui.click('Stop public sharing');

test('actual client handlers ignore every pending response and geolocation callback after confirmed Stop',async()=>{
 for(const action of ['state','start','geolocation','share']){
  const gate=deferred(),ui=setup({pending:{action,...gate},holdLocation:action==='geolocation'});
  ui.consent();share(ui);await flush();stop(ui);await flush();
  assert.equal(ui.message(),'Public sharing stopped.');
  if(action==='geolocation')ui.location();else gate.resolve(Response.json(receipt({action})));
  await flush();assert.equal(ui.message(),'Public sharing stopped.');assert.equal(ui.checkbox().checked,false);
  const postStop=ui.calls.slice(ui.calls.findIndex(call=>call.action==='stop')+1);
  assert.deepEqual(postStop,[],action);
 }
});

test('Stop disables an existing refresh timer immediately and synchronously rejects duplicate Stop',async()=>{
 const gate=deferred(),ui=setup({stopResponse:()=>gate.promise});ui.consent();share(ui);await flush();ui.startTimer();
 stop(ui);stop(ui);ui.tick();ui.tick();assert.equal(ui.calls.filter(call=>call.action==='stop').length,1);assert.equal(ui.calls.filter(call=>call.action==='share').length,1);
 gate.resolve(Response.json({sharing:false,mode:'live'}));await flush();assert.equal(ui.message(),'Public sharing stopped.');ui.tick();assert.equal(ui.calls.length,4);
});

test('failed and malformed Stop receipts never claim revocation and never restart automatic refresh',async()=>{
 for(const body of [{},{sharing:true,mode:'live'},{sharing:false,mode:'test'}]){
  const ui=setup({stopResponse:async()=>Response.json(body)});ui.consent();share(ui);await flush();ui.startTimer();stop(ui);await flush();
  assert.match(ui.message(),/Stop could not be confirmed/);assert.match(ui.message(),/Retry Stop/);assert.match(ui.message(),/another open page or session/);assert.doesNotMatch(ui.message(),/within three minutes|Automatic refresh is off/);ui.tick();assert.equal(ui.calls.filter(call=>call.action==='share').length,1);assert.equal(ui.checkbox().checked,false);
 }
 const ui=setup({stopResponse:async()=>{throw Error('network interrupted');}});stop(ui);await flush();assert.match(ui.message(),/Stop could not be confirmed/);
});

test('malformed state, session and share receipts never render a successful share',async()=>{
 for(const action of ['state','start','share']){
  const gate=deferred(),ui=setup({pending:{action,...gate}});ui.consent();share(ui);await flush();gate.resolve(Response.json({}));await flush();
  assert.match(ui.message(),/could not be verified/);assert.doesNotMatch(ui.message(),/Approximate presence shared/);
 }
});
