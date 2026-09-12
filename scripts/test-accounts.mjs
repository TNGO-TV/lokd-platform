import { readFile, writeFile, unlink, mkdir, access as fileAccess } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClerkClient } from '@clerk/backend';

// Never load .env.local: it belongs to the production application.
const keys = parseEnv(await readFile('.env.clerk-test', 'utf8'));
keys.CLERK_PUBLISHABLE_KEY ||= keys.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!keys.CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !keys.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('Account checks require development Clerk keys in .env.clerk-test. Production keys are refused.');
}
const clerk = createClerkClient({ publishableKey: keys.CLERK_PUBLISHABLE_KEY, secretKey: keys.CLERK_SECRET_KEY, telemetry: { disabled: true } });
const browserLibraries = `${process.cwd()}/.sites-runtime/browser-libs/usr/lib/x86_64-linux-gnu`;
let localBrowserLibraries = false;
try { await fileAccess(browserLibraries); localBrowserLibraries = true; } catch { /* Use system libraries. */ }
const run = randomUUID();
const users = [];
const userIds = {};
const includeFinance = process.env.LOKD_ACCOUNT_TEST_FINANCE === 'true';
const emails = Object.fromEntries(['client', 'officer', 'operations', 'unassigned', 'owner', ...(includeFinance ? ['finance'] : [])].map(role => [role, `lokd-${role}+clerk_test_${run}@example.com`]));
const access = { clients: { [emails.client]: 'CL-001' }, officers: { [emails.officer]: 'OFF-001' }, operations: [emails.operations, ...(includeFinance ? [emails.finance] : [])], owners: [emails.owner] };
let ownsVars = false;
let failed = false;
try {
  // Exclusive creation avoids overwriting another developer's local environment.
  await writeFile('.dev.vars', [
    `CLERK_PUBLISHABLE_KEY=${JSON.stringify(keys.CLERK_PUBLISHABLE_KEY)}`,
    `CLERK_SECRET_KEY=${JSON.stringify(keys.CLERK_SECRET_KEY)}`,
    'CLERK_AUTHORIZED_PARTIES="http://localhost:4177"',
    `LOKD_APP_STAGE=${JSON.stringify(process.env.LOKD_ACCOUNT_TEST_STAGE === 'production' ? 'production' : 'demo')}`,
    ...(process.env.LOKD_ACCOUNT_TEST_STAGE === 'production' ? ['LOKD_OPERATIONS_MFA_REQUIRED="false"'] : []),
    `LOKD_PILOT_ACCESS_JSON='${JSON.stringify(access)}'`,
    'LOKD_LIVE_SHIFT_SCAN="false"',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  ownsVars = true;
  for (const [role, email] of Object.entries(emails)) {
    const user = await clerk.users.createUser({ emailAddress: [email], skipPasswordRequirement: true, privateMetadata: { lokdAccountTestRun: run, role } });
    users.push(user.id);
    userIds[role] = user.id;
  }
  console.log('Created isolated Clerk development identities. No inboxes or invitations required.');
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=tests/accounts/playwright.config.mjs', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, ...keys, ...(localBrowserLibraries ? { LD_LIBRARY_PATH: [browserLibraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : {}), LOKD_TEST_EMAILS: JSON.stringify(emails), LOKD_TEST_USER_IDS: JSON.stringify(userIds) },
  });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  failed = code !== 0;
} catch (error) {
  // SDK errors can contain request details. Log only non-sensitive diagnostic codes.
  console.error('Account workflow failed:', error.code || error.errors?.map(item => item.code).join(', ') || error.name);
  failed = true;
} finally {
  const remaining = [];
  for (const id of users) {
    try { await clerk.users.deleteUser(id); } catch { remaining.push(id); }
  }
  if (ownsVars) await unlink('.dev.vars');
  if (remaining.length) {
    await mkdir('test-results', { recursive: true });
    await writeFile('test-results/clerk-cleanup.json', JSON.stringify({ run, userIds: remaining }, null, 2), { mode: 0o600 });
    console.error('Development user cleanup needs retry; see test-results/clerk-cleanup.json.');
    failed = true;
  } else console.log('Development test identities and temporary local configuration cleaned up.');
}
process.exitCode = failed ? 1 : 0;
