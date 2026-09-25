import {test,expect} from '@playwright/test';
const empty={rows:[],version:'provider-check-v1',amountMinor:100,currency:'ZAR',mode:'test',financialEffect:false};
const row={reference:'lokd-provider-test-00000000-0000-0000-0000-000000000000',scenario:'success',revision:2,state:'awaiting_checkout',checkout_url:'https://checkout.paystack.com/test-fixture',provider_status:null,webhook_hash:null,note:'',updated_at:'2026-09-25T01:00:00Z'};
test('test-only acknowledgement, duplicate guard, exact scenario and no horizontal overflow',async({page})=>{
 let release;const wait=new Promise(resolve=>release=resolve),posts=[];
 await page.route('**/api/provider-test',async r=>{if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());await wait;return r.fulfill({json:{...empty,rows:[row]}});}return r.fulfill({json:empty});});
 await page.goto('/ops/payment-test');await page.getByRole('button',{name:'Prepare success TEST checkout',exact:true}).click();const form=page.getByRole('form',{name:'Prepare success TEST checkout'});
 await expect(form.getByRole('checkbox')).not.toBeChecked();await expect(form.getByRole('button',{name:'Confirm prepare success test checkout'})).toBeDisabled();
 await form.getByRole('checkbox').check();await form.evaluate(f=>{f.requestSubmit();f.requestSubmit();});await expect.poll(()=>posts.length).toBe(1);release();
 await expect(page.getByRole('link',{name:'Open success TEST checkout'})).toHaveAttribute('href',row.checkout_url);
 expect(posts).toEqual([{action:'initialize',scenario:'success',version:'provider-check-v1',testOnlyAcknowledged:true}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('failed recheck preserves reference and access loss clears private evidence',async({page})=>{
 let status=503;const posts=[];
 await page.route('**/api/provider-test',async r=>{if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());return r.fulfill({status,json:{error:status===503?'Provider unavailable':'Access revoked'}});}return r.fulfill({json:{...empty,rows:[row]}});});
 await page.goto('/ops/payment-test');await page.getByRole('button',{name:'Check success provider result'}).click();await expect(page.getByRole('alert')).toContainText('Provider unavailable');await expect(page.getByText(row.reference,{exact:true})).toBeVisible();
 expect(posts[0]).toEqual({action:'reconcile',reference:row.reference,expectedRevision:2});status=403;await page.getByRole('button',{name:'Check success provider result'}).click();await expect(page.getByRole('alert')).toContainText('Access revoked');await expect(page.getByText(row.reference,{exact:true})).toHaveCount(0);
});
