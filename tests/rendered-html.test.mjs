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
  assert.match(html, /No credit terms/i);
  assert.match(html, /Track your|track your submission/i);
  assert.match(html, /Request security/i);
  assert.doesNotMatch(html, /<dd>R800<\/dd>|Prototype offer|Passport preview ready/i);
  assert.doesNotMatch(html, /Starter Project/i);
});
