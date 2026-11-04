import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const code=ts.transpileModule(fs.readFileSync(new URL('../app/verify/page.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const token='lokd_live_'+'a'.repeat(64);
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
function fixture(){
 const effects=[],timers=new Map(),listeners=new Map(),requests=[],exports={};let sequence=0;
 const location={hash:'#token='+token,search:'',pathname:'/verify'};
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:f=>effects.push(f)},'next/link':{default:'a'},'../components/public-site-shell':{PublicHeader:'header',PublicFooter:'footer'}};
 vm.runInNewContext(code,{exports,require:key=>modules[key],URL,URLSearchParams,Date,Intl,AbortSignal,Error,location,
  history:{state:null,replaceState(){location.hash='';location.search='';}},
  setTimeout:f=>{const id=++sequence;timers.set(id,f);return id;},clearTimeout:id=>timers.delete(id),
  addEventListener:(name,f)=>listeners.set(name,f),removeEventListener:(name,f)=>{if(listeners.get(name)===f)listeners.delete(name);},
  fetch:async(_url,options)=>{requests.push(JSON.parse(options.body));return Response.json({passport:{environment:'production',officerName:'Local fixture',passportNumber:'LOCAL-FIXTURE',psiraGrade:'Grade C',status:'active',result:'green',verifiedAt:new Date().toISOString()}});},
 });
 exports.default();
 return{effects,requests,location,listeners,runTimers(){for(const [id,f] of timers){timers.delete(id);f();}}};
}
test('QR fragment survives a cancelled initial effect and is removed before verification',async()=>{
 const f=fixture();const first=f.effects[1]();first();assert.equal(f.location.hash,'#token='+token);assert.equal(f.requests.length,0);
 const dispose=f.effects[1]();f.runTimers();await settle();assert.equal(f.location.hash,'');assert.equal(f.requests.length,1);assert.equal(f.requests[0].token,token);dispose();assert.equal(f.listeners.size,0);
});
test('a new QR fragment on the open verification page starts a fresh check',async()=>{
 const f=fixture();const dispose=f.effects[1]();f.runTimers();await settle();
 const next='lokd_live_'+'b'.repeat(64);f.location.hash='#token='+next;f.listeners.get('hashchange')();await settle();assert.equal(f.location.hash,'');assert.equal(f.requests.length,2);assert.equal(f.requests[1].token,next);dispose();
});
