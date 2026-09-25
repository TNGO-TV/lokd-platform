import {test,expect} from '@playwright/test';
test('pending delivery read never claims delivery is disabled or jobs are absent',async({page})=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await page.route('**/api/signup*',r=>r.fulfill({json:{items:[],hasMore:false}}));
 await page.route('**/api/operational-delivery',async r=>{await wait;return r.fulfill({json:{enabled:true,jobs:[]}});});
 await page.goto('/ops/intake');const panel=page.getByRole('region',{name:'Booking and agreement delivery'});
 await expect(panel).toContainText('Loading delivery status…');await expect(panel).not.toContainText('External delivery is off');await expect(panel).not.toContainText('No delivery jobs recorded.');
 release();await expect(panel).toContainText('Controlled delivery is limited');await expect(panel).toContainText('No delivery jobs recorded.');
});
test('an initial read failure shows unknown status, not disabled delivery',async({page})=>{
 await page.route('**/api/signup*',r=>r.fulfill({json:{items:[],hasMore:false}}));
 await page.route('**/api/operational-delivery',r=>r.fulfill({status:503,json:{error:'Storage temporarily unavailable.'}}));
 await page.goto('/ops/intake');const panel=page.getByRole('region',{name:'Booking and agreement delivery'});
 await expect(panel.getByRole('alert')).toContainText('Storage temporarily unavailable.');await expect(panel).toContainText('Delivery status is unavailable.');await expect(panel).not.toContainText('External delivery is off');await expect(panel).not.toContainText('No delivery jobs recorded.');
});
