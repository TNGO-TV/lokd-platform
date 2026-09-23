import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createHmac } from 'node:crypto';
import { env } from 'cloudflare:workers';
import { GET as live } from '../app/api/health/live/route.ts';
import { GET as ready } from '../app/api/health/ready/route.ts';
import { POST } from '../app/api/paystack/transfers/live/webhook/route.ts';

// Mount the actual Worker fetch path, replacing only framework/browser services.
// The forwarded callback executes the real route and HMAC receiver.
const result=await build({entryPoints:[new URL('../worker/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',packages:'external',plugins:[{name:'worker-fixture',setup(b){
  // The fixture loads its bundle from a data URL; external SDK imports need an
  // absolute module URL. The SDK is not invoked by these callback-routing tests.
  b.onResolve({filter:/^@clerk\/backend$/},()=>({path:import.meta.resolve('@clerk/backend'),external:true}));
  b.onResolve({filter:/^(vinext\/server\/|\.\/clerk-auth$)/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='./clerk-auth'
    ? 'export async function authenticateClerkRequest(){return globalThis.__lokdRoutingAuth();}'
    : args.path.includes('image-optimization')
      ? 'export const DEFAULT_DEVICE_SIZES=[],DEFAULT_IMAGE_SIZES=[];export function handleImageOptimization(){throw Error("unexpected image");}'
      : 'export default {fetch(...args){return globalThis.__lokdRoutingHandler(...args);}};',loader:'js'}));
}}]});
const worker=(await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default;

test('live transfer HMAC callback is independent of Clerk failure and handshake',async()=>{
  let lookups=0,authCalls=0;
  env.DB={prepare:()=>({bind:()=>({first:async()=>{lookups++;return null;}})})};
  env.PAYSTACK_LIVE_SECRET_KEY='sk_live_isolated_fixture';
  globalThis.__lokdRoutingHandler=request=>new URL(request.url).pathname==='/api/health/live'?live():new URL(request.url).pathname==='/api/health/ready'?ready():POST(request);
  const raw=JSON.stringify({event:'transfer.success',data:{domain:'live',reference:'unknown_fixture_reference'}});
  const signature=createHmac('sha512',env.PAYSTACK_LIVE_SECRET_KEY).update(raw).digest('hex');
  const request=signature=>new Request('https://lokd.example/api/paystack/transfers/live/webhook',{method:'POST',headers:{'x-paystack-signature':signature},body:raw});
  try{
    for(const mode of ['throw','handshake']){
      globalThis.__lokdRoutingAuth=()=>{authCalls++;if(mode==='throw')throw Error('Clerk unavailable');return {response:new Response(null,{status:307,headers:{location:'/sign-in'}})};};
      const accepted=await worker.fetch(request(signature),{},{});
      assert.equal(accepted.status,200);
      assert.equal(accepted.headers.get("x-frame-options"),"DENY");
      assert.equal(accepted.headers.get("referrer-policy"),"no-referrer");
      assert.deepEqual(await accepted.json(),{received:true,matched:false});
      assert.equal((await worker.fetch(request('0'.repeat(128)),{},{})).status,401);
      assert.equal((await worker.fetch(new Request('https://lokd.example/api/health/live'),{},{})).status,200);
      const probe=await worker.fetch(new Request('https://lokd.example/api/health/ready'),{},{});
      assert.equal(probe.status,503);
      assert.equal(probe.headers.get("x-content-type-options"),"nosniff");
      assert.equal((await probe.json()).status,'unavailable');
      assert.equal((await worker.fetch(new Request('https://lokd.example/api/production-operations'),{},{})).status,mode==='throw'?503:307);
    }
    assert.equal(lookups,2,'invalid signatures never reach storage');
    assert.equal(authCalls,2,'only ordinary application requests invoke Clerk');
  }finally{delete env.DB;delete env.PAYSTACK_LIVE_SECRET_KEY;delete globalThis.__lokdRoutingAuth;delete globalThis.__lokdRoutingHandler;}
});

test('application errors are reported as service failures, not authentication failures', async () => {
  globalThis.__lokdRoutingAuth = () => ({ request: new Request('https://lokd.example/client'), headers: new Headers() });
  globalThis.__lokdRoutingHandler = () => { throw Error('private storage detail'); };
  try {
    for (const path of ['/client', '/api/health/live', '/api/paystack/transfers/live/webhook']) {
      const response = await worker.fetch(new Request('https://lokd.example' + path), {}, {});
      assert.equal(response.status, 503);
      assert.equal(await response.text(), 'Service temporarily unavailable.');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
  } finally { delete globalThis.__lokdRoutingAuth; delete globalThis.__lokdRoutingHandler; }
});
