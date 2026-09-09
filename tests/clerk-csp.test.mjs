import test from 'node:test';
import assert from 'node:assert/strict';

test('release CSP permits Clerk authentication while excluding development hosts and arbitrary scripts', async () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const { default: config } = await import('../next.config.ts?production-csp');
    const rules = await config.headers();
    const policy = rules[0].headers.find(header => header.key === 'Content-Security-Policy').value;
    const directives = Object.fromEntries(policy.split('; ').map(directive => { const [name, ...sources] = directive.split(' '); return [name, sources]; }));
    for (const name of ['script-src', 'connect-src']) assert.ok(directives[name].includes('https://clerk.lokd.co.za'));
    assert.ok(directives['frame-src'].includes('https://challenges.cloudflare.com'));
    assert.ok(directives['img-src'].includes('https://img.clerk.com'));
    assert.ok(!policy.includes('clerk.accounts.dev'));
    assert.ok(!directives['script-src'].includes('https:'));
    assert.ok(!directives['script-src'].includes("'unsafe-eval'"));
    assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
    assert.deepEqual(directives['object-src'], ["'none'"]);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
