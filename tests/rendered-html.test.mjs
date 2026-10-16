import assert from "node:assert/strict";
import test from "node:test";

test("renders the canonical public LOKD launch identity with real signup entry points and no simulated offers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>LOKD Security \| Guarding, Armed Security and VIP Protection<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/lokd\.co\.za\/?"\/>/i);
  assert.match(html, /Sign in with your application email to track your progress/i);
  assert.match(html, /An application does not guarantee work\./i);
  assert.match(html, /Service starts only after terms are agreed and Operations confirms readiness\./i);

  // Check actual rendered anchors, not labels that could survive with broken
  // destinations or occur only in the serialized React payload.
  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, attributes, content]) => ({
    href: attributes.match(/\bhref="([^"]*)"/i)?.[1],
    text: content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  }));
  for (const [href, label] of [
    ["/contact", "Request security"],
    ["/join", "Apply as an officer"],
    ["/contact", "Start a security enquiry"],
    ["/join", "Start an application"],
    ["/join?path=training", "Explore training pathways"],
    ["https://portal.lokd.co.za", "Client sign in"],
    ["https://officers.lokd.co.za", "Officer sign in"],
    ["/security-services", "Security services"],
    ["/armed-security", "Armed security"],
    ["/vip-protection", "VIP protection"],
    ["/privacy", "Privacy notice"],
    ["/terms-and-conditions", "Terms and conditions"],
  ]) {
    assert.ok(links.some((link) => link.href === href && link.text.startsWith(label)), `${label} must link to ${href}`);
  }
  assert.doesNotMatch(html, /<dd>R800<\/dd>|Prototype offer|Passport preview ready/i);
  assert.doesNotMatch(html, /Starter Project/i);
  assert.doesNotMatch(html, /Verified officers/);
  assert.match(html, /Security services · Officer applications/);
});

test('built Worker rejects rehearsal paths and router aliases on production despite forged test host headers',async()=>{
 const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url).href);
 let touched=0;
 const environment={LOKD_APP_STAGE:'demo',LOKD_TEST_SURFACES_ENABLED:'true',DB:{prepare(){touched++;throw Error('Primary database must not be touched');}},ASSETS:{fetch:async()=>new Response('not found',{status:404})}};
 const context={waitUntil(){},passThroughOnException(){}};
 for(const path of ['/api/pilot','/api/pilot/','/api/%70ilot','/api/platform/export','/api/platform/export/file','/api/sandbox/identity','/api/agreements/test','/api/test-cycle','/api/finance-workflows','/api/finance-workflows/webhook','/api/paystack/test/webhook']){
  const response=await worker.fetch(new Request('https://operations.lokd.co.za'+path,{headers:{host:'demo.lokd.co.za','x-forwarded-host':'demo.lokd.co.za','x-lokd-verified-email':'owner@example.test'}}),environment,context);
  assert.equal(response.status,404,path);
 }
 assert.equal(touched,0);
});

test("built Worker HTML nonces every executable bootstrap script and replaces attacker CSP", async () => {
  const {default: worker}=await import(new URL('../dist/server/index.js',import.meta.url).href);
  const environment={ASSETS:{fetch:async()=>new Response('not found',{status:404})}},context={waitUntil(){},passThroughOnException(){}};
  const request=()=>new Request('https://lokd.example/',{headers:{accept:'text/html','content-security-policy':"script-src 'nonce-attacker'",'x-lokd-script-nonce':'attacker'}});
  const first=await worker.fetch(request(),environment,context),second=await worker.fetch(request(),environment,context);
  assert.equal(first.status,200);assert.equal(second.status,200);
  const policy=first.headers.get('content-security-policy');
  const nonce=policy?.match(/'nonce-([^']+)'/)?.[1];assert.ok(nonce);assert.notEqual(nonce,'attacker');
  assert.ok(!policy.split('; ').find(d=>d.startsWith('script-src')).includes('unsafe-inline'));
  assert.notEqual(policy,second.headers.get('content-security-policy'));
  assert.equal(first.headers.get('cache-control'),'private, no-store');
  const html=await first.text(),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length>2,'actual SSR includes bootstrap and RSC scripts');
  for(const [,attributes] of scripts){assert.ok(attributes.includes(`nonce="${nonce}"`),`script lacks response nonce: ${attributes}`);}
  assert.match(html,/Symbol\.for\("vinext\.navigationRuntime"\)/);
  assert.match(html,/\.bootstrap\.rsc/);
});
