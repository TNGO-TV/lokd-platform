import { readFile, writeFile, unlink, mkdir, access as fileAccess, readdir, rename, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
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
const includeFinance = process.env.LOKD_ACCOUNT_TEST_FINANCE === 'true' || process.env.LOKD_ACCOUNT_TEST_PAYMENTS === 'true';
const emails = Object.fromEntries(['client', 'officer', 'operations', 'unassigned', 'owner', ...(includeFinance ? ['finance'] : [])].map(role => [role, `lokd-${role}+clerk_test_${run}@example.com`]));
const access = { clients: { [emails.client]: 'CL-001' }, officers: { [emails.officer]: 'OFF-001' }, operations: [emails.operations, ...(includeFinance ? [emails.finance] : [])], owners: [emails.owner] };
let ownsVars = false;
let failed = false;
const partnerDestinationFixture=process.env.LOKD_ACCOUNT_TEST_PARTNER_DESTINATIONS==='true';
const partnerFixture=process.env.LOKD_ACCOUNT_TEST_PARTNER_PAYABLES==='true';
const paymentFixture=process.env.LOKD_ACCOUNT_TEST_PAYMENTS==='true';
const destinationFixture=process.env.LOKD_ACCOUNT_TEST_DESTINATIONS==='true';
const collectionFixture=process.env.LOKD_ACCOUNT_TEST_COLLECTIONS==='true'||destinationFixture||paymentFixture||partnerFixture||partnerDestinationFixture;
let collectionDatabase,collectionBackup,collectionInstalled=false,collectionExport;
const collectionMoved=[];
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
  if(collectionFixture){
    // Refuse to replace local data while the acceptance server is already running.
    const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(4177,'127.0.0.1',resolve);});await new Promise(resolve=>probe.close(resolve));
    const directory=process.cwd()+'/.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
    const names=(await readdir(directory)).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');if(names.length!==1)throw Error('Ambiguous local acceptance database');
    collectionDatabase=directory+'/'+names[0];collectionExport='/tmp/lokd-collection-'+run+'.sqlite';
    const fixture=spawn(process.execPath,['--experimental-loader=./tests/cloudflare-loader.mjs',partnerDestinationFixture?'--test-name-pattern=production partner destinations':partnerFixture?'--test-name-pattern=production partner payables':paymentFixture?'--test-name-pattern=production period payroll':destinationFixture?'--test-name-pattern=production destinations':'--test-name-pattern=production intake prepares','tests/assignment-activation-db.test.mjs'],{stdio:'inherit',env:{...process.env,...(partnerDestinationFixture?{LOKD_PARTNER_DESTINATION_FIXTURE_EXPORT:collectionExport,LOKD_PARTNER_DESTINATION_BROWSER_USERS:JSON.stringify(userIds),LOKD_PARTNER_DESTINATION_BROWSER_EMAILS:JSON.stringify(emails)}:partnerFixture?{LOKD_PARTNER_FIXTURE_EXPORT:collectionExport,LOKD_PARTNER_MAKER_USER:userIds.operations,LOKD_PARTNER_MAKER_EMAIL:emails.operations,LOKD_PARTNER_FINANCE_USER:userIds.owner,LOKD_PARTNER_FINANCE_EMAIL:emails.owner,LOKD_PARTNER_OFFICER_USER:userIds.officer,LOKD_PARTNER_OFFICER_EMAIL:emails.officer,LOKD_PARTNER_CLIENT_USER:userIds.client,LOKD_PARTNER_CLIENT_EMAIL:emails.client}:paymentFixture?{LOKD_PAYMENT_FIXTURE_EXPORT:collectionExport,LOKD_PAYMENT_BROWSER_USERS:JSON.stringify(userIds),LOKD_PAYMENT_BROWSER_EMAILS:JSON.stringify(emails)}:destinationFixture?{LOKD_DESTINATION_FIXTURE_EXPORT:collectionExport,LOKD_DESTINATION_BROWSER_USERS:JSON.stringify(userIds),LOKD_DESTINATION_BROWSER_EMAILS:JSON.stringify(emails)}:{LOKD_COLLECTION_FIXTURE_EXPORT:collectionExport,LOKD_COLLECTION_BROWSER_USERS:JSON.stringify(userIds),LOKD_COLLECTION_BROWSER_EMAILS:JSON.stringify(emails)})}});
    if(await new Promise((resolve,reject)=>{fixture.on('error',reject);fixture.on('exit',resolve);})!==0)throw Error('Collection fixture did not pass');
    collectionBackup=await mkdtemp(directory+'/lokd-collection-original-');
    for(const suffix of ['','-wal','-shm']){try{await fileAccess(collectionDatabase+suffix);}catch{continue;}await rename(collectionDatabase+suffix,collectionBackup+'/database'+suffix);collectionMoved.push(suffix);}
    collectionInstalled=true;await copyFile(collectionExport,collectionDatabase);
    console.log('Installed isolated collection fixture; original local database preserved for restoration.');
  }
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
  if(collectionDatabase){
    if(collectionInstalled)for(const suffix of ['','-wal','-shm'])await rm(collectionDatabase+suffix,{force:true});
    for(const suffix of collectionMoved)await rename(collectionBackup+'/database'+suffix,collectionDatabase+suffix);
    if(collectionBackup)await rm(collectionBackup,{recursive:true,force:true});
    if(collectionExport)await rm(collectionExport,{force:true});
    console.log('Original local database restored.');
  }
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
