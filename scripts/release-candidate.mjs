import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assessAudit } from './check-dependency-audit.mjs';

// Local, unsigned candidate evidence. This is not deployment authorization or
// evidence linking a candidate to any historical Cloudflare deployment.
const root = process.cwd();
const release = '.sites-runtime/release';
const candidate = `${release}/candidate.json`;
const pending = `${release}/pending.json`;
const validationFiles = [
  `${release}/validation.log`,
  'test-results/dependency-audit.json',
  'test-results/dependency-boundary-rsc.json',
];
const hash = (data) => createHash('sha256').update(data).digest('hex');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
function requireCondition(value, message) { if (!value) throw new Error(message); }
function source() {
  requireCondition(!git('status', '--porcelain', '--untracked-files=normal'), 'Release source must be clean, including untracked source files.');
  return { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), lockSha256: hash(readFileSync('package-lock.json')) };
}
function same(actual, expected, label) {
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} changed since validation; prepare a new candidate.`);
}
function regularFile(file) {
  const stat = lstatSync(file);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `Not a regular file: ${file}`);
  return { path: file.replaceAll('\\', '/'), bytes: stat.size, sha256: hash(readFileSync(file)) };
}
function artifacts(dir = 'dist') {
  requireCondition(lstatSync(dir).isDirectory() && !lstatSync(dir).isSymbolicLink(), `Not a real artifact directory: ${dir}`);
  return readdirSync(dir).sort().flatMap((name) => {
    const entry = `${dir}/${name}`;
    requireCondition(!lstatSync(entry).isSymbolicLink(), `Artifact symlinks are not permitted: ${entry}`);
    return lstatSync(entry).isDirectory() ? artifacts(entry) : [regularFile(entry)];
  });
}
function settingsMatch(actual, expected) {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length
    && [...expected].sort().every((value, index) => settingsMatch([...actual].sort()[index], value));
  if (expected !== null && typeof expected === 'object') return actual !== null && typeof actual === 'object'
    && Object.entries(expected).every(([key, value]) => Object.hasOwn(actual, key) && settingsMatch(actual[key], value));
  return actual === expected;
}
function nativeConfig() {
  const configPath = 'dist/server/wrangler.json';
  const config = json(configPath);
  const original = json('wrangler.jsonc'); // This repository's config is strict JSON.
  requireCondition(config.name === original.name && config.account_id === original.account_id, 'Native Worker/account configuration mismatch.');
  requireCondition(!process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID === original.account_id, 'Cloudflare account environment differs from validated configuration.');
  for (const kind of ['d1_databases', 'r2_buckets']) {
    const expected = original[kind];
    const actual = config[kind];
    requireCondition(Array.isArray(expected) && Array.isArray(actual) && actual.length === expected.length,
      `Native ${kind} bindings mismatch.`);
    for (const binding of expected) {
      // Vite relocates migration paths; deployment never applies migrations.
      // Every other explicitly configured binding property must survive.
      const settings = Object.fromEntries(Object.entries(binding).filter(([key]) => key !== 'migrations_dir'));
      requireCondition(actual.filter((entry) => entry.binding === binding.binding).length === 1
        && settingsMatch(actual.find((entry) => entry.binding === binding.binding), settings), `Native ${kind} bindings mismatch.`);
    }
  }
  for (const [key, value] of Object.entries(original)) {
    if (['$schema', 'main', 'd1_databases', 'r2_buckets'].includes(key)) continue;
    // Only generated filesystem paths may differ. Require every explicit
    // policy setting; no absent-value defaults can hide removed bindings,
    // schedules, vars, asset behavior or compatibility/observability settings.
    const expected = key === 'assets' ? Object.fromEntries(Object.entries(value).filter(([field]) => field !== 'directory')) : value;
    requireCondition(Object.hasOwn(config, key) && settingsMatch(config[key], expected), `Native ${key} configuration mismatch.`);
    if (key === 'vars') requireCondition(Object.keys(config.vars).length === Object.keys(value).length, 'Native vars configuration mismatch.');
  }
  requireCondition(!config.build?.command, 'Generated config must not invoke a second build.');
  for (const target of [config.main, config.assets?.directory]) {
    requireCondition(typeof target === 'string', 'Native artifact needs both Worker and asset paths.');
    const resolved = path.resolve(path.dirname(configPath), target);
    requireCondition(resolved.startsWith(path.join(root, 'dist') + path.sep), 'Generated config references files outside the validated artifact.');
    requireCondition(existsSync(resolved), `Missing generated target: ${target}`);
  }
  return configPath;
}
function validations() {
  // Include every generated bundle boundary (rsc, ssr, etc.), not only rsc.
  const extras = readdirSync('test-results').filter((name) => /^dependency-boundary-.+\.json$/.test(name)).map((name) => `test-results/${name}`);
  const files = [...new Set([...validationFiles, ...extras])].sort().map(regularFile);
  const audit = json('test-results/dependency-audit.json');
  requireCondition([0, 1].includes(audit.npmExit), 'Audit evidence needs a completed npm process.');
  requireCondition(audit.assessment?.ok === true && Array.isArray(audit.assessment.blocked) && audit.assessment.blocked.length === 0, 'Audit assessment must pass with no blocked advisories.');
  const reassessed = assessAudit(audit.report, json('package-lock.json'));
  requireCondition(reassessed.ok && reassessed.blocked.length === 0, 'Current lockfile audit assessment blocks release.');
  same(reassessed, audit.assessment, 'Audit assessment');
  for (const file of extras) {
    const boundary = json(file);
    requireCondition(Array.isArray(boundary.checkedPackages)
      && JSON.stringify([...boundary.checkedPackages].sort()) === JSON.stringify(['braces', 'fast-glob', 'micromatch'])
      && Number.isSafeInteger(boundary.moduleCount) && boundary.moduleCount > 0
      && typeof boundary.moduleGraphSha256 === 'string' && /^[a-f0-9]{64}$/.test(boundary.moduleGraphSha256),
    `Invalid dependency boundary evidence: ${file}`);
  }
  return files;
}
try {
  requireCondition(process.env.LOKD_NATIVE_CF === '1', 'Native release preparation requires LOKD_NATIVE_CF=1.');
  const action = process.argv[2];
  if (action === 'begin') {
    mkdirSync(release, { recursive: true });
    rmSync(candidate, { force: true });
    rmSync(pending, { force: true });
    for (const file of validationFiles) rmSync(file, { force: true });
    if (existsSync('test-results')) for (const name of readdirSync('test-results')) {
      if (/^dependency-boundary-.+\.json$/.test(name)) rmSync(`test-results/${name}`);
    }
    writeFileSync(pending, JSON.stringify({ source: source(), startedAt: new Date().toISOString() }, null, 2) + '\n');
  } else if (action === 'seal') {
    const started = json(pending);
    same(source(), started.source, 'Source');
    const config = nativeConfig();
    const receipt = { version: 1, kind: 'validated-native-candidate', source: started.source,
      startedAt: started.startedAt, validatedAt: new Date().toISOString(), command: 'LOKD_NATIVE_CF=1 npm run check:security',
      node: process.version, config, validations: validations(), artifacts: artifacts(),
      migrationRequirement: 'Apply migration 0082 before deploying the updated intake handler; do not roll back to the phone-deduplicating handler. Migration execution is a separate authorized operation.' };
    writeFileSync(candidate, JSON.stringify(receipt, null, 2) + '\n');
    rmSync(pending, { force: true });
    console.log(`Prepared ${candidate} for ${receipt.source.commit}; receipt sha256 ${hash(readFileSync(candidate))}; no deployment performed.`);
  } else if (action === 'verify') {
    const receipt = json(candidate);
    requireCondition(receipt.version === 1 && receipt.kind === 'validated-native-candidate', 'Invalid release receipt.');
    same(source(), receipt.source, 'Source');
    same(nativeConfig(), receipt.config, 'Native configuration');
    same(validations(), receipt.validations, 'Validation evidence');
    same(artifacts(), receipt.artifacts, 'Artifact');
    same(process.version, receipt.node, 'Node runtime');
    console.log(`Verified candidate ${receipt.source.commit}; receipt sha256 ${hash(readFileSync(candidate))}`);
  } else throw new Error('Usage: release-candidate.mjs begin|seal|verify');
} catch (error) {
  console.error(`Release blocked: ${error.message}`);
  process.exitCode = 1;
}
