import test from 'node:test';
import assert from 'node:assert/strict';
import {readRequestBytes,readRequestText,RequestBodyError} from '../app/lib/request-body.ts';
import {submitClientEnquiry} from '../app/api/enquiries/route.ts';
import {submitOfficerApplication} from '../app/api/applications/route.ts';
function source(chunks,headers={}){
 let reads=0,cancelled=false;
 const body=new ReadableStream({pull(c){if(reads===chunks.length){c.close();return;}c.enqueue(chunks[reads++]);},cancel(){cancelled=true;}},{highWaterMark:0});
 return {body,headers:new Headers(headers),state:()=>({reads,cancelled})};
}
const bytes=s=>new TextEncoder().encode(s);
const status=n=>e=>e instanceof RequestBodyError&&e.status===n;
test('byte reader preserves exact signed bytes and text joins split multibyte input',async()=>{
 const raw=Uint8Array.of(0,255,13,10,128);assert.deepEqual(await readRequestBytes(new Response(raw),5),raw);
 const utf8=bytes('€x');assert.equal(await readRequestText(source([utf8.slice(0,1),utf8.slice(1)]),4),'€x');
 assert.equal(await readRequestText({headers:new Headers(),body:null},1),'');
});
test('actual bytes enforce the limit without trusting absent or understated Content-Length',async()=>{
 for(const headers of [{},{'content-length':'1'}]){
  const s=source([bytes('1234'),bytes('5'),bytes('not consumed')],headers);
  await assert.rejects(readRequestBytes(s,4),status(413));assert.deepEqual(s.state(),{reads:2,cancelled:true});
 }
 const s=source([bytes('€€'),bytes('not consumed')]);await assert.rejects(readRequestText(s,4),status(413));assert.equal(s.state().cancelled,true);
});
test('invalid or oversized declared length cancels before pulling a byte',async()=>{
 for(const value of ['5','-1','oops','1.5','1, 1','9007199254740992']){
  const s=source([bytes('x')],{'content-length':value});await assert.rejects(readRequestBytes(s,4),status(413));assert.deepEqual(s.state(),{reads:0,cancelled:true});
 }
});
test('malformed UTF8 fails with typed 400 while raw bytes remain supported',async()=>{
 await assert.rejects(readRequestText(source([Uint8Array.of(0xc3,0x28)]),2),status(400));
});
test('deadline cancels a stalled body without waiting for a stalled cancellation',async()=>{
 let cancelled=false;
 const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;return new Promise(()=>{});}});
 const start=Date.now();await assert.rejects(readRequestBytes({body,headers:new Headers()},10,20),status(408));assert.equal(cancelled,true);assert.ok(Date.now()-start<1000);
});
test('deadline applies to the whole body rather than resetting after each chunk',async()=>{
 let cancelled=false;
 const body=new ReadableStream({async pull(c){await new Promise(r=>setTimeout(r,8));if(!cancelled)c.enqueue(bytes('x'));},cancel(){cancelled=true;}},{highWaterMark:0});
 await assert.rejects(readRequestBytes({body,headers:new Headers()},100,25),status(408));assert.equal(cancelled,true);
});
test('public intake rejects oversized bodies early and returns typed failures before storage access',async()=>{
 for(const [handler,path,cap] of [[submitClientEnquiry,'enquiries',14000],[submitOfficerApplication,'applications',16000]]){
  const s=source([new Uint8Array(cap+1),bytes('must remain unread')]);
  const r=new Request('https://demo.lokd.co.za/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:s.body,duplex:'half'});
  assert.equal((await handler(r)).status,413);assert.deepEqual(s.state(),{reads:1,cancelled:true});
  const malformed=new Request(r.url,{method:'POST',headers:{'content-type':'application/json'},body:Uint8Array.of(255)});
  assert.equal((await handler(malformed)).status,400);
 }
});
