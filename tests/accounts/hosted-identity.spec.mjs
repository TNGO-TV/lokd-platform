import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
import {createClerkClient} from '@clerk/backend';
import {randomUUID} from 'node:crypto';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS),client=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,telemetry:{disabled:true}});
test.beforeAll(async()=>{await clerkSetup({dotenv:false});});
test('hosted development sign-up verifies a test email through the actual embedded Clerk form',async({page})=>{
 const email=`lokd-new-${randomUUID()}+clerk_test@example.com`;let id;
 try{
  await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});
  await page.getByRole('link',{name:'Sign up',exact:true}).click();
  await page.getByRole('textbox',{name:/email address/i}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Sandbox!'+randomUUID());
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('textbox',{name:/verification code/i}).fill('424242');
  await expect.poll(async()=>{try{return await page.evaluate(()=>window.Clerk?.user?.id??null);}catch{return null;}},{timeout:15000}).not.toBeNull();id=await page.evaluate(()=>window.Clerk.user.id);
  const user=await client.users.getUser(id);expect(user.emailAddresses.find(x=>x.emailAddress===email)?.verification?.status).toBe('verified');
  await page.goto('/ops');await expect(page.getByRole('heading',{name:/access is not assigned/})).toBeVisible();
  await clerk.signOut({page});await page.goto('/officer');await expect(page).toHaveURL(/sign-in/);
 }finally{
  if(!id){const result=await client.users.getUserList({emailAddress:[email]});id=result.data[0]?.id;}
  if(id)await client.users.deleteUser(id);
 }
});
test('hosted session revocation prevents reuse of an otherwise unexpired bearer',async({page,request})=>{
 await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails.operations}});
 const {sessionId,token}=await page.evaluate(async()=>({sessionId:window.Clerk.session.id,token:await window.Clerk.session.getToken({skipCache:true})}));
 const before=await request.get('/api/operations/security',{headers:{authorization:`Bearer ${token}`}});expect(before.status()).toBe(200);
 await client.sessions.revokeSession(sessionId);
 const after=await request.get('/api/operations/security',{headers:{authorization:`Bearer ${token}`}});expect(after.status()).toBe(401);
 await page.goto('/ops');await expect(page).toHaveURL(/sign-in/);
});
test('an expired hosted development bearer is denied while the active session can obtain a fresh token',async({page,request})=>{
 test.setTimeout(120000);await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails.operations}});
 const token=await page.evaluate(()=>window.Clerk.session.getToken({skipCache:true})),claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
 expect((await request.get('/api/operations/security',{headers:{authorization:`Bearer ${token}`}})).status()).toBe(200);
 const wait=claims.exp*1000-Date.now()+10000;expect(wait).toBeGreaterThan(0);expect(wait).toBeLessThan(100000);await new Promise(resolve=>setTimeout(resolve,wait));
 expect((await request.get('/api/operations/security',{headers:{authorization:`Bearer ${token}`}})).status()).toBe(401);
 const fresh=await page.evaluate(()=>window.Clerk.session.getToken({skipCache:true}));expect((await request.get('/api/operations/security',{headers:{authorization:`Bearer ${fresh}`}})).status()).toBe(200);
});
