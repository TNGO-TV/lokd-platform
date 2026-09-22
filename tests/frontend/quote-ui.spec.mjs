import {test,expect} from '@playwright/test';
const scope={clientName:'Synthetic Client Ltd',contactName:'Test Client',siteName:'Test Site',address:'Test address',siteArea:'Sandton',serviceType:'Unarmed',purposeLabel:'Commercial access',postName:'Gate',instructions:'Access control for the agreed entrance.',startDate:'2030-01-02',endDate:'2030-01-02',shiftStart:'06:00',shiftEnd:'18:00',rosterPattern:'daily',headcount:1,shiftCount:1,subtotalCents:100000,vatCents:15000,totalCents:115000,fundingModel:'advance',creditTermsDays:0,riskBand:'Standard',specialistConfiguration:'{}'};
const quote={id:'QUOTE-fixture',order_id:'ORDER-fixture',terms_id:'TERMS-fixture',terms_title:'Standard terms',terms_version:'v1',source_json:JSON.stringify(scope),offer_hash:'fixture-hash',sequence:1,expires_at:'2030-01-01T20:00:00Z',cancelled:0,terms_withdrawn:0,receipt_json:null};
test('linked terms, unchecked acceptance, exact submission and receipt work on mobile and desktop (mock responses)',async({page})=>{
 let state={quotes:[{...quote}],terms:[],orders:[],owner:false,acknowledgement:'I accept this quote and the linked Terms and Conditions.'},posts=[];
 await page.route('**/api/quotes',async route=>{if(route.request().method()==='POST'){const b=route.request().postDataJSON();posts.push(b);state.quotes[0].receipt_json=JSON.stringify({acceptedAt:'2026-09-22T19:00:00Z'});}await route.fulfill({json:state});});
 await page.goto('/client/quotes');
 const checkbox=page.getByRole('checkbox');await expect(checkbox).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Accept quote',exact:true})).toBeDisabled();
 await expect(page.getByRole('link',{name:/Read Terms and Conditions/})).toHaveAttribute('href','/api/quotes?file=TERMS-fixture');
 await checkbox.check();await page.getByRole('button',{name:'Accept quote',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download acceptance record'})).toBeVisible();
 expect(posts).toEqual([{action:'accept',quoteId:'QUOTE-fixture',offerHash:'fixture-hash',affirmative:true}]);
 await page.reload();await expect(page.getByRole('button',{name:'Accept quote',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('expired quotes cannot be accepted; access loss clears client quote data (mock responses)',async({page})=>{
 let revoked=false;
 await page.route('**/api/quotes',route=>revoked?route.fulfill({status:401,json:{error:'Sign in to continue.'}}):route.fulfill({json:{quotes:[{...quote,expires_at:'2020-01-01T00:00:00Z'}],terms:[],orders:[],owner:false,acknowledgement:'I agree'}}));
 await page.goto('/client/quotes');await expect(page.getByText('Expired',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Accept quote',exact:true})).toHaveCount(0);
 revoked=true;await page.getByRole('button',{name:'Refresh quotes'}).click();
 await expect(page.getByRole('heading',{name:'Workspace access unavailable'})).toBeVisible();
 await expect(page.getByText('Synthetic Client Ltd',{exact:false})).toHaveCount(0);
});
