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
  assert.match(html, /<link rel="canonical" href="https:\/\/lokd\.co\.za\/"\/>/i);
  assert.doesNotMatch(html, /advance funding|No credit terms/i);
  assert.match(html, /Track your|track your submission/i);
  assert.match(html, /Request security/i);
  assert.doesNotMatch(html, /<dd>R800<\/dd>|Prototype offer|Passport preview ready/i);
  assert.doesNotMatch(html, /Starter Project/i);
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
  assert.match(html,/self\.__VINEXT_RSC/);
});
