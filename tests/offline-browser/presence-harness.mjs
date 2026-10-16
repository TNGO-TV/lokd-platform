import {build} from 'esbuild';
import {env} from 'cloudflare:workers';
import {presenceFixture} from '../fixtures/presence.mjs';
import {POST,GET} from '../../app/api/presence/route.ts';
import {secureRequest,secureResponse} from '../../app/lib/security-headers.ts';

// This harness runs only in the loopback test server, with a fresh in-memory
// assignment and synthetic account. It mounts the real React component and
// calls the real API handler. Browser geolocation and document policy are real;
// Playwright supplies synthetic coordinates, never the user's location.
const bundle=await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import Panel from './app/components/officer-presence-panel.tsx';createRoot(document.getElementById('root')).render(<Panel/>);",resolveDir:process.cwd(),sourcefile:'presence-fixture.tsx',loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
let fixture;
export async function presenceHarness(request){
 const url=new URL(request.url);
 if(url.pathname==='/__presence.js')return new Response(bundle.outputFiles[0].contents,{headers:{'content-type':'text/javascript'}});
 if(request.method==='GET'&&url.searchParams.get('presence-fixture')==='1'&&['/officer','/privacy'].includes(url.pathname)){
  fixture?.sql.close();fixture=presenceFixture();env.DB=fixture.db;
  const secured=secureRequest(request);
  return secureResponse(new Response(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated officer presence fixture</title></head><body><main id="root"></main><script type="module" nonce="${secured.nonce}" src="/__presence.js"></script></body></html>`,{headers:{'content-type':'text/html'}}),secured.policy,secured.request);
 }
 if(fixture&&url.pathname==='/api/presence'){
  if(request.method==='GET')return GET();
  if(request.method==='POST'){
   const headers=new Headers(request.headers);
   headers.set('x-lokd-verified-user-id','user');headers.set('x-lokd-verified-email','officer@example.test');
   return POST(new Request(request,{headers}));
  }
 }
 return null;
}
