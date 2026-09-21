import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.route('**/api/agreements/production?**',route=>route.fulfill({json:{documents:[],envelopes:[],entities:[],owner:false}}));
});
test('delivery distinguishes accepted from delivered and keeps outbound disabled',async({page})=>{
 await page.route('**/api/operational-delivery',route=>route.fulfill({json:{enabled:false,jobs:[{id:'contract:fixture',kind:'contract_email',sourceId:'ENV-SYNTHETIC',state:'sent',attempts:1,recipient:'signer@example.test',providerId:'synthetic-provider-reference',lastError:null,updatedAt:'2026-09-21T12:00:00Z'}]}}));
 await page.goto('/ops/agreements');const panel=page.getByRole('region',{name:'Booking and agreement delivery'});
 await expect(panel.getByText(/External delivery is off/)).toBeVisible();await expect(panel.getByText(/Accepted by provider/)).toBeVisible();await expect(panel.getByText('Email delivery confirmed')).toHaveCount(0);await expect(panel.getByRole('button',{name:'Process due test deliveries'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.route('**/api/operational-delivery',route=>route.fulfill({status:403,json:{error:'Access revoked.'}}));await panel.getByRole('button',{name:'Refresh delivery status'}).click();await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByText('signer@example.test',{exact:false})).toHaveCount(0);
});
test('issued agreement shows queued email without claiming inbox delivery',async({page})=>{
 await page.route('**/api/agreements/production?**',route=>route.fulfill({json:{documents:[],entities:[],owner:false,envelopes:[{id:'ENV-SYNTHETIC',role:'SERVICE_ORDER',wording:'Synthetic UI wording only.',context_json:'{}',expires_at:'2099-01-01T00:00:00Z',email_delivery_state:'queued',cancelled:0,document_withdrawn:0,receipt_json:null}]}}));
 await page.goto('/client/agreements#ENV-SYNTHETIC');await expect(page.locator('#ENV-SYNTHETIC')).toBeVisible();await expect(page.getByText(/Email: queued/)).toBeVisible();await expect(page.getByRole('button',{name:'Agree and record my signature'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
