import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const zeroFindings = { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
const passingAudit = () => ({ npmExit: 0, report: { auditReportVersion: 2, metadata: { vulnerabilities: { ...zeroFindings } }, vulnerabilities: {} },
  assessment: { ok: true, blocked: [], dispositions: [], raw: { ...zeroFindings } } });
const passingBoundary = () => ({ checkedPackages: ['braces', 'micromatch', 'fast-glob'], moduleCount: 1, moduleGraphSha256: 'a'.repeat(64) });
const passingBrowser = () => ({stats:{expected:8,unexpected:0,flaky:0,skipped:0},errors:[]});

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lokd-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, data) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), data); };
  for (const file of ['scripts/release-candidate.mjs', 'scripts/deploy-native-cf.sh', 'scripts/check-dependency-audit.mjs']) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); copyFileSync(file, path.join(root, file));
  }
  const original = { name: 'lokd-security', account_id: 'd7000a5708fdeb67be6e21ee40e9105e',
    compatibility_date: '2026-09-14', compatibility_flags: ['nodejs_compat'], workers_dev: true, keep_vars: true, upload_source_maps: true,
    assets: { directory: './dist/client', binding: 'ASSETS', not_found_handling: 'none' }, images: { binding: 'IMAGES' },
    triggers: { crons: ['* * * * *'] }, vars: { LOKD_PUBLIC_ORIGIN: 'https://lokd.co.za', LOKD_APP_STAGE: 'prelaunch' }, observability: { enabled: true },
    d1_databases: [{ binding: 'DB', database_name: 'lokd-security', database_id: 'real-database' }],
    r2_buckets: [{ binding: 'BUCKET', bucket_name: 'lokd-security' }] };
  put('wrangler.jsonc', JSON.stringify(original)); put('package-lock.json', '{}\n');
  put('.gitignore', '/.sites-runtime/\n/dist/\n/test-results/\n/node_modules/\n');
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Release test', '-c', 'user.email=release@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture'], { cwd: root });
  const env = { ...process.env, LOKD_NATIVE_CF: '1', CLOUDFLARE_ACCOUNT_ID: original.account_id };
  const run = (action) => spawnSync(process.execPath, ['scripts/release-candidate.mjs', action], { cwd: root, env, encoding: 'utf8' });
  const outputs = () => {
    put('dist/server/wrangler.json', JSON.stringify({ ...original, main: 'index.js', assets: { ...original.assets, directory: '../client' } }));
    put('dist/server/index.js', 'export default {};\n'); put('dist/client/index.html', '<p>candidate</p>');
    put('.sites-runtime/release/validation.log', 'All security checks passed\n');
    put('test-results/dependency-audit.json', JSON.stringify(passingAudit()));
    put('test-results/dependency-boundary-rsc.json', JSON.stringify(passingBoundary()));
    put('test-results/offline-browser/results.json', JSON.stringify(passingBrowser()));
  };
  const prepare = () => { assert.equal(run('begin').status, 0); outputs(); const sealed = run('seal'); assert.equal(sealed.status, 0, sealed.stderr); };
  return { root, put, original, env, run, outputs, prepare };
}

test('candidate records exact source, lock, native assets and validation evidence', (t) => {
  const f = fixture(t); f.prepare();
  const receipt = JSON.parse(readFileSync(path.join(f.root, '.sites-runtime/release/candidate.json')));
  assert.match(receipt.source.commit, /^[a-f0-9]{40}$/); assert.match(receipt.source.tree, /^[a-f0-9]{40}$/);
  assert.equal(receipt.artifacts.length, 3); assert.equal(receipt.validations.length, 4);
  assert.equal(f.run('verify').status, 0); assert.match(receipt.migrationRequirement, /0082 before deploying/);
});

test('CI summary exposes only validated boundary fields, source commit, config key names and artifact count', (t) => {
  const f = fixture(t); assert.equal(f.run('begin').status, 0); f.outputs();
  const result = f.run('seal'); assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout.split('\n').find((line) => line.startsWith('{')));
  assert.deepEqual(Object.keys(summary).sort(), ['artifactFileCount', 'dependencyBoundaries', 'nativeConfigMatchedKeys', 'sourceCommit']);
  assert.equal(summary.artifactFileCount, 3); assert.match(summary.sourceCommit, /^[a-f0-9]{40}$/);
  assert.ok(summary.nativeConfigMatchedKeys.includes('vars')); assert.ok(summary.nativeConfigMatchedKeys.includes('images'));
  assert.deepEqual(summary.dependencyBoundaries, [{ path: 'test-results/dependency-boundary-rsc.json', ...passingBoundary() }]);
  assert.doesNotMatch(result.stdout, /https:\/\/lokd|prelaunch|real-database/);
});

test('artifact, validation, lock and untracked source drift independently block deployment verification', (t) => {
  for (const [name, edit] of [
    ['artifact', (f) => f.put('dist/client/index.html', 'changed')],
    ['validation', (f) => f.put('test-results/dependency-audit.json', 'changed')],
    ['browser evidence', (f) => f.put('test-results/offline-browser/results.json', 'changed')],
    ['lock', (f) => f.put('package-lock.json', '{"changed":true}')],
    ['untracked source', (f) => f.put('unexpected.js', 'changed')],
  ]) {
    const f = fixture(t); f.prepare(); edit(f);
    assert.notEqual(f.run('verify').status, 0, `${name} must block`);
  }
});

test('failed or incomplete preparation invalidates previous receipts and cannot seal', (t) => {
  const f = fixture(t); f.prepare(); assert.equal(f.run('begin').status, 0);
  assert.equal(existsSync(path.join(f.root, '.sites-runtime/release/candidate.json')), false);
  assert.notEqual(f.run('seal').status, 0); assert.notEqual(f.run('verify').status, 0);
});

test('native configuration rejects placeholder bindings, outside artifacts, and second builds', (t) => {
  for (const change of [
    { d1_databases: [] }, { r2_buckets: [] }, { main: '../../worker/index.ts' }, { build: { command: 'rebuild' } },
  ]) {
    const f = fixture(t); assert.equal(f.run('begin').status, 0); f.outputs();
    f.put('dist/server/wrangler.json', JSON.stringify({ ...f.original, main: 'index.js', assets: { ...f.original.assets, directory: '../client' }, ...change }));
    assert.notEqual(f.run('seal').status, 0);
  }
});

test('native policy settings cannot silently disappear or change and values are not disclosed', (t) => {
  const f = fixture(t);
  for (const change of [
    { images: undefined }, { images: { binding: 'OTHER' } }, { vars: undefined }, { vars: { ...f.original.vars, LOKD_APP_STAGE: 'secret-changed-value' } },
    { vars: { ...f.original.vars, EXTRA_FLAG: 'secret-added-value' } }, { triggers: undefined }, { triggers: { crons: [] } }, { triggers: { crons: ['0 * * * *'] } },
    { compatibility_date: undefined }, { compatibility_flags: [] }, { keep_vars: undefined }, { workers_dev: false }, { observability: { enabled: false } },
    { assets: { directory: '../client', binding: 'ASSETS' } }, { upload_source_maps: false }, { upload_source_maps: undefined },
  ]) {
    assert.equal(f.run('begin').status, 0); f.outputs();
    f.put('dist/server/wrangler.json', JSON.stringify({ ...f.original, main: 'index.js', assets: { ...f.original.assets, directory: '../client' }, ...change }));
    const result = f.run('seal'); assert.notEqual(result.status, 0, Object.keys(change)[0]);
    assert.match(result.stderr, /Native .* configuration mismatch/); assert.doesNotMatch(result.stderr, /secret-(?:changed|added)-value/);
  }
});

test('source change during validation and missing native mode cannot produce a candidate', (t) => {
  const f = fixture(t); assert.equal(f.run('begin').status, 0); f.outputs(); f.put('wrangler.jsonc', '{}');
  assert.notEqual(f.run('seal').status, 0);
  const noNative = spawnSync(process.execPath, ['scripts/release-candidate.mjs', 'begin'], { cwd: f.root, env: { ...f.env, LOKD_NATIVE_CF: '' }, encoding: 'utf8' });
  assert.notEqual(noNative.status, 0);
});

test('undeclared deployment policy and nested binding properties fail sealing and verification', (t) => {
  const f = fixture(t);
  const additions = [
    { routes: [{ pattern: 'unreviewed.invalid/*' }] }, { route: 'unreviewed.invalid/*' },
    { services: [{ binding: 'EXTRA', service: 'other-worker' }] }, { kv_namespaces: [{ binding: 'EXTRA', id: '0'.repeat(32) }] },
    { durable_objects: { bindings: [{ name: 'EXTRA', class_name: 'Extra' }] } }, { queues: { producers: [{ binding: 'EXTRA', queue: 'extra' }], consumers: [] } },
    { send_email: [{ name: 'EXTRA' }] }, { secrets_store_secrets: [{ binding: 'EXTRA' }] }, { browser: { binding: 'EXTRA' } },
    { tail_consumers: [{ service: 'other-worker' }] }, { unsafe: { bindings: [{ name: 'EXTRA', type: 'plain_text', text: 'hidden-value' }] } },
    { placement: { mode: 'smart' } }, { preview_urls: true }, { unknown_future_binding: [] }, { targetEnvironment: 'other' },
    { assets: { ...f.original.assets, directory: '../client', run_worker_first: true } },
    { observability: { enabled: true, head_sampling_rate: 0 } },
    { images: { binding: 'IMAGES', remote: true } },
    { d1_databases: [{ ...f.original.d1_databases[0], preview_database_id: 'other' }] },
    { d1_databases: [{ ...f.original.d1_databases[0], remote: true }] },
    { r2_buckets: [{ ...f.original.r2_buckets[0], jurisdiction: 'eu' }] },
    { build: { watch_dir: './src', cwd: '/unreviewed' } }, { rules: [{ type: 'Data', globs: ['**/*'] }] },
    { configPath: '/unreviewed/wrangler.jsonc' }, { k2: [{binding:'EXTRA'}] },
  ];
  const config = (extra) => JSON.stringify({ ...f.original, main: 'index.js', assets: { ...f.original.assets, directory: '../client' }, ...extra });
  assert.equal(f.run('begin').status, 0); f.outputs();
  for (const extra of additions) {
    f.put('dist/server/wrangler.json', config(extra)); const result = f.run('seal');
    assert.notEqual(result.status, 0, Object.keys(extra)[0]);
    assert.match(result.stderr, /Undeclared native configuration|Native .* (?:configuration|bindings) mismatch/);
    assert.doesNotMatch(result.stderr, /hidden-value/);
  }
  f.prepare();
  for (const extra of additions) {
    f.put('dist/server/wrangler.json', config(extra)); const result = f.run('verify');
    assert.notEqual(result.status, 0, Object.keys(extra)[0]);
    assert.match(result.stderr, /Undeclared native configuration|Native .* (?:configuration|bindings) mismatch/);
  }
});

test('only exact documented generated defaults and relocated migration paths are accepted', (t) => {
  const f = fixture(t); assert.equal(f.run('begin').status, 0); f.outputs();
  const emptyFamilies = Object.fromEntries(['workflows', 'migrations', 'kv_namespaces', 'send_email', 'connect', 'vectorize',
    'ai_search_namespaces', 'ai_search', 'agent_memory', 'hyperdrive', 'services', 'analytics_engine_datasets',
    'dispatch_namespaces', 'mtls_certificates', 'pipelines', 'k2', 'secrets_store_secrets', 'artifacts', 'unsafe_hello_world',
    'flagship', 'worker_loaders', 'ratelimits', 'vpc_services', 'vpc_networks'].map((key) => [key, []]));
  const config = { ...f.original, ...emptyFamilies, main: 'index.js', assets: { ...f.original.assets, directory: '../client' },
    d1_databases: [{ ...f.original.d1_databases[0], migrations_dir: '../../migrations' }],
    configPath: path.join(f.root, 'wrangler.jsonc'), userConfigPath: 'wrangler.jsonc', topLevelName: f.original.name, definedEnvironments: [],
    define: {}, exports: {}, cloudchamber: {}, unsafe: {}, durable_objects: { bindings: [] }, queues: { producers: [], consumers: [] },
    logfwdr: { bindings: [] }, jsx_factory: 'React.createElement', jsx_fragment: 'React.Fragment', build: { watch_dir: './src' },
    python_modules: { exclude: ['**/*.pyc'] }, no_bundle: true, rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
    dev: { ip: 'localhost', local_protocol: 'http', upstream_protocol: 'http', enable_containers: true, generate_types: false } };
  f.put('dist/server/wrangler.json', JSON.stringify(config)); let result = f.run('seal'); assert.equal(result.status, 0, result.stderr);
  result = f.run('verify'); assert.equal(result.status, 0, result.stderr);
  config.d1_databases[0].migrations_dir = '../../unreviewed';
  f.put('dist/server/wrangler.json', JSON.stringify(config)); result = f.run('verify'); assert.notEqual(result.status, 0); assert.match(result.stderr, /migration path mismatch/);
});

test('failed, inconsistent or malformed dependency evidence cannot be sealed', (t) => {
  const f = fixture(t);
  for (const mutate of [
    (a) => { a.npmExit = 2; },
    (a) => { a.assessment.ok = false; },
    (a) => { a.assessment.blocked = [{ advisory: 'blocked' }]; },
    (a) => { a.report = {}; },
    (a) => { a.report.metadata.vulnerabilities.high = 1; },
    (a) => { a.assessment.raw.high = 1; },
    (a) => { a.report.metadata.vulnerabilities = { ...zeroFindings, total: 1, high: 1 }; a.report.vulnerabilities = {
      unsafe: { name: 'unsafe', severity: 'high', nodes: ['node_modules/unsafe'], via: [{ url: 'https://example.invalid/advisory', severity: 'high' }] },
    }; },
  ]) {
    assert.equal(f.run('begin').status, 0); f.outputs(); const audit = passingAudit(); mutate(audit);
    f.put('test-results/dependency-audit.json', JSON.stringify(audit)); assert.notEqual(f.run('seal').status, 0);
  }
  for (const change of [{ checkedPackages: ['braces'] }, { checkedPackages: ['braces', 'micromatch', 'fast-glob', 'braces'] },
    { moduleCount: 0 }, { moduleCount: 1.5 }, { moduleGraphSha256: 'not-a-hash' }]) {
    assert.equal(f.run('begin').status, 0); f.outputs();
    f.put('test-results/dependency-boundary-ssr.json', JSON.stringify({ ...passingBoundary(), ...change }));
    assert.notEqual(f.run('seal').status, 0, JSON.stringify(change));
  }
});

test('candidate verification rechecks dependency assessment semantics', (t) => {
  const f = fixture(t); f.prepare(); const audit = passingAudit(); audit.assessment.ok = false;
  f.put('test-results/dependency-audit.json', JSON.stringify(audit));
  const result = f.run('verify'); assert.notEqual(result.status, 0); assert.match(result.stderr, /Audit assessment must pass/);
});

function shellFixture(t) {
  const f = fixture(t);
  // Stub every external validation/deploy process; these tests never contact a
  // provider, run a real build, or invoke real Wrangler.
  f.put('node_modules/.bin/npm', `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == "run check:security" && "$LOKD_NATIVE_CF" == 1 ]]
printf '%s\\n' "$HOME" > .sites-runtime/gate-home
echo 'stub audit/lint/type/schema/build/tests'
if [[ -f .sites-runtime/fail-gate ]]; then exit 17; fi
node .sites-runtime/stub-build.cjs
`);
  f.put('node_modules/.bin/wrangler', `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == 'deploy --config dist/server/wrangler.json --no-bundle' ]]
printf '%s\\n' "$HOME" > .sites-runtime/deploy-home
echo deployed >> .sites-runtime/deploy-calls
`);
  f.put('.sites-runtime/stub-build.cjs', `const fs=require('node:fs');
for(const dir of ['dist/server','dist/client','test-results/offline-browser'])fs.mkdirSync(dir,{recursive:true});
const original=JSON.parse(fs.readFileSync('wrangler.jsonc'));
fs.writeFileSync('dist/server/wrangler.json',JSON.stringify({...original,main:'index.js',assets:{...original.assets,directory:'../client'}}));
fs.writeFileSync('dist/server/index.js','export default {};');fs.writeFileSync('dist/client/index.html','candidate');
fs.writeFileSync('test-results/dependency-audit.json',${JSON.stringify(JSON.stringify(passingAudit()))});fs.writeFileSync('test-results/dependency-boundary-rsc.json',${JSON.stringify(JSON.stringify(passingBoundary()))});
fs.writeFileSync('test-results/offline-browser/results.json',${JSON.stringify(JSON.stringify(passingBrowser()))});
`);
  execFileSync('chmod', ['+x', 'node_modules/.bin/npm', 'node_modules/.bin/wrangler'], { cwd: f.root });
  const runShell = (mode) => spawnSync('bash', ['scripts/deploy-native-cf.sh', mode], {
    cwd: f.root, encoding: 'utf8', env: { ...f.env, PATH: `${path.join(f.root, 'node_modules/.bin')}:${process.env.PATH}`, HOME: '/owner-credentials-home' },
  });
  return { ...f, runShell };
}

test('prepare only never deploys; deploying verified candidate preserves HOME and performs no rebuild', { skip: process.platform === 'win32' ? 'Bash release wrapper requires supported Linux CI' : false }, (t) => {
  const f = shellFixture(t); let result = f.runShell('--prepare'); assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(path.join(f.root, '.sites-runtime/deploy-calls')), false);
  const before = readFileSync(path.join(f.root, '.sites-runtime/release/candidate.json'), 'utf8');
  f.put('.sites-runtime/fail-gate', 'if a rebuild occurs it fails');
  result = f.runShell('--deploy-candidate'); assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(f.root, '.sites-runtime/deploy-home'), 'utf8').trim(), '/owner-credentials-home');
  assert.equal(readFileSync(path.join(f.root, '.sites-runtime/release/candidate.json'), 'utf8'), before);
});

test('failing gate stops deployment and removes stale candidate; modified build stops later deployment', { skip: process.platform === 'win32' ? 'Bash release wrapper requires supported Linux CI' : false }, (t) => {
  const f = shellFixture(t); assert.equal(f.runShell('--prepare').status, 0);
  f.put('.sites-runtime/fail-gate', 'audit failed');
  assert.notEqual(f.runShell('--prepare-and-deploy').status, 0);
  assert.equal(existsSync(path.join(f.root, '.sites-runtime/deploy-calls')), false);
  assert.notEqual(f.runShell('--deploy-candidate').status, 0);
  rmSync(path.join(f.root, '.sites-runtime/fail-gate')); assert.equal(f.runShell('--prepare').status, 0);
  f.put('dist/server/index.js', 'changed after validation'); assert.notEqual(f.runShell('--deploy-candidate').status, 0);
  assert.equal(existsSync(path.join(f.root, '.sites-runtime/deploy-calls')), false);
});
