import test from 'node:test';
import assert from 'node:assert/strict';

test('Worker policy loads scripts only from LOKD and Cloudflare challenges in every mode', async () => {
  const {secureRequest} = await import('../app/lib/security-headers.ts');
  const original=process.env.NODE_ENV;
  try {
    for(const mode of ['development','production',undefined]) {
      if(mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=mode;
      const {policy}=secureRequest(new Request('https://lokd.example/'));
      assert.ok(!/clerk/i.test(policy));
      assert.ok(!policy.includes("'unsafe-eval'"));
      assert.ok(!policy.includes('script-src https:'));
    }
  } finally {
    if(original===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original;
  }
});

test('release CSP keeps scripts, connections and frames first-party', async () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const { default: config } = await import('../next.config.ts?production-csp');
    const rules = await config.headers();
    const policy = rules[0].headers.find(header => header.key === 'Content-Security-Policy').value;
    const directives = Object.fromEntries(policy.split('; ').map(directive => { const [name, ...sources] = directive.split(' '); return [name, sources]; }));
    assert.deepEqual(directives['connect-src'], ["'self'"]);
    assert.ok(new Set(directives['frame-src']).has('https://challenges.cloudflare.com'));
    assert.ok(!/clerk/i.test(policy));
    assert.ok(!directives['script-src'].includes('https:'));
    assert.ok(!directives['script-src'].includes("'unsafe-eval'"));
    assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
    assert.deepEqual(directives['object-src'], ["'none'"]);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});

test('Worker nonce ignores attacker headers, changes per response and preserves private attachment policies', async () => {
  const {secureRequest,secureResponse} = await import('../app/lib/security-headers.ts');
  const input=new Request('https://lokd.example/',{headers:{'content-security-policy':"script-src 'nonce-attacker'",'content-security-policy-report-only':"script-src 'nonce-attacker'",'x-lokd-script-nonce':'attacker'}});
  const first=secureRequest(input),second=secureRequest(input);
  assert.notEqual(first.nonce,second.nonce);assert.notEqual(first.nonce,'attacker');
  assert.equal(first.request.headers.get('x-lokd-script-nonce'),first.nonce);
  assert.equal(first.request.headers.get('content-security-policy-report-only'),null);
  assert.match(first.policy,new RegExp("'nonce-"+first.nonce.replace(/[\\^$.*+?()[\]{}|/]/g,'\\$&')+"'"));
  assert.ok(!first.policy.split('; ').find(x=>x.startsWith('script-src')).includes('unsafe-inline'));
  const html=secureResponse(new Response('<html/>',{headers:{'content-type':'text/html','cache-control':'public,max-age=3600'}}),first.policy);
  assert.equal(html.headers.get('content-security-policy'),first.policy);assert.equal(html.headers.get('cache-control'),'private, no-store');
  const attachment=secureResponse(new Response('private',{headers:{'content-type':'text/html','content-disposition':'attachment','content-security-policy':"default-src 'none'; sandbox"}}),first.policy);
  assert.equal(attachment.headers.get('content-security-policy'),"default-src 'none'; sandbox");
  for(const response of [html,attachment,secureResponse(new Response(null,{status:307,headers:{location:'/sign-in'}}),first.policy),secureResponse(new Response('failed',{status:503}),first.policy)]){
    assert.equal(response.headers.get('x-frame-options'),'DENY');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  }
});
