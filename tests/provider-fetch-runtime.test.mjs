import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fetchWithoutRedirect} from '../app/lib/provider-fetch.ts';

test('provider redirects are refused without forwarding credentials or accepting a response',async()=>{
 for(const status of [300,301,302,303,304,305,307,308]){
  let calls=0,cancelled=false;
  const body=status===304?null:new ReadableStream({cancel(){cancelled=true;}});
  const transport=async(_url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(body,{status,headers:{location:'https://untrusted.example/collect'}});};
  await assert.rejects(()=>fetchWithoutRedirect(transport,'https://provider.example/send',{method:'POST',headers:{Authorization:'synthetic-secret'},body:'synthetic',redirect:'follow'}),/Provider redirect refused/);
  assert.equal(calls,1);assert.equal(cancelled,status!==304);
 }
});

test('actual Worker runtime sends provider requests and refuses redirects before a second request',async()=>{
 const out=await build({stdin:{contents:`import {fetchWithoutRedirect} from './app/lib/provider-fetch';
 export default {async fetch(request){try{const response=await fetchWithoutRedirect(fetch,'https://provider.example/'+new URL(request.url).pathname.slice(1),{method:'POST',headers:{Authorization:'synthetic-only'},body:'synthetic-body',signal:AbortSignal.timeout(15000)});return new Response(await response.text(),{status:response.status});}catch(error){return Response.json({error:error.message},{status:502});}}};`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
 const calls=[];
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-09-11',compatibilityFlags:['nodejs_compat'],script:out.outputFiles[0].text,outboundService:async request=>{
  calls.push({url:request.url,authorization:request.headers.get('Authorization'),body:await request.text()});
  const code=Number(new URL(request.url).pathname.slice(1));
  return new Response(code===200?'accepted':null,{status:code,headers:code===200?{}:{location:'https://untrusted.example/collect'}});
 }}));
 try{
  for(const code of [200,302,307,308]){
   const before=calls.length,response=await mf.dispatchFetch('https://fixture.invalid/'+code);
   assert.equal(response.status,code===200?200:502);
   assert.equal(await response.text(),code===200?'accepted':JSON.stringify({error:'Provider redirect refused'}));
   assert.equal(calls.length,before+1);assert.equal(calls.at(-1).url,'https://provider.example/'+code);
   assert.equal(calls.at(-1).authorization,'synthetic-only');assert.equal(calls.at(-1).body,'synthetic-body');
  }
 }finally{await mf.dispose();}
});
