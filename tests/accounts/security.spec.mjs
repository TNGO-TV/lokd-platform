import { test, expect } from '@playwright/test';
import { clerk, clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createHmac } from 'node:crypto';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.beforeAll(async()=>{await clerkSetup({dotenv:false});});
function totp(secret) {
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const char of secret.toUpperCase().replace(/=+$/,''))bits+=alphabet.indexOf(char).toString(2).padStart(5,'0');
 const key=Buffer.from(bits.match(/.{8}/g).map(byte=>parseInt(byte,2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=createHmac('sha1',key).update(counter).digest(),offset=digest[19]&15;
 return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
test('Operations enrolls a real development second factor and the server verifies refreshed session proof',async({page})=>{
 await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});
 await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails.operations}});
 await page.goto('/ops/security');await clerk.loaded({page});await expect(page.getByRole('heading',{name:'Operations account security'})).toBeVisible();
 await page.getByRole('button',{name:'Verify second factor'}).click();
 await expect(page.getByRole('status')).toContainText('Enrol an authenticator in Account security first.');
 // Use Clerk's real development enrollment/verification endpoints. The TOTP
 // secret lives only in this test process and the temporary user is deleted.
 const secret=await page.evaluate(async()=> (await window.Clerk.user.createTOTP()).secret);
 await page.evaluate(async code=>{await window.Clerk.user.verifyTOTP({code});await window.Clerk.user.reload();},totp(secret));
 await page.evaluate(async()=>{await window.Clerk.session.startVerification({level:'second_factor'});});
 await page.evaluate(async code=>{await window.Clerk.session.attemptSecondFactorVerification({strategy:'totp',code});},totp(secret));
 await page.getByRole('button',{name:'Verify second factor'}).click();
 await expect(page.getByRole('status')).toContainText('Second factor verified');
 const result=await page.evaluate(async()=>{
  const token=await window.Clerk.session.getToken({skipCache:true});
  return (await fetch('/api/operations/security',{headers:{authorization:`Bearer ${token}`}})).json();
 });
 expect(result.enrolled).toBe(true);expect(result.fresh).toBe(true);
});
