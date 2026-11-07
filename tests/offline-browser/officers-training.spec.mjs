import {test,expect} from '@playwright/test';

const origin='http://127.0.0.1:4173';
const reference='TRN-12345678-1234-4123-8123-123456789ABC';
test.beforeEach(async({context})=>{
 await context.route('**/*',async route=>{
  const r=route.request(),url=new URL(r.url());
  if(url.origin!==origin||url.pathname.startsWith('/api/')||!['GET','HEAD'].includes(r.method()))return route.abort();
  return route.continue();
 });
});
const fits=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
async function fillBooking(page){
 await page.locator('select[name="course"]').selectOption('grade-e');
 await page.locator('input[name="preferredIntakeMonth"]').fill(new Date(Date.now()+60*86400000).toISOString().slice(0,7));
 await page.getByLabel(/^Full name/).fill('Browser Applicant');
 await page.getByLabel(/^Mobile number/).fill('0821234567');
 await page.getByLabel(/^Email address/).fill('applicant@example.test');
 await page.getByLabel(/^Identity document status/).selectOption('available');
 await page.getByLabel(/^PSIRA registration status/).selectOption('not_registered');
 await page.locator('input[name="consent"]').check();
}
test('officers offers exactly the registered and new application routes',async({page},testInfo)=>{
 await page.goto('/officers');await expect(page.getByRole('heading',{level:1})).toHaveText('Put your skills to work.');
 await expect(page.locator('.officers-options > a')).toHaveCount(2);
 await expect(page.getByRole('link',{name:'PSIRA Registered or renewal',exact:true})).toHaveAttribute('href','/join?path=registered');
 await expect(page.getByRole('link',{name:'New Application',exact:true})).toHaveAttribute('href','/join?path=new');
 await expect(page.getByRole('heading',{name:'On-demand and roster work'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Work matched to your grade'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Book Now',exact:true})).toHaveAttribute('href','/training#training-booking');
 await fits(page);await page.screenshot({path:testInfo.outputPath('officers.png'),fullPage:true});
});
test('new application explains all six steps and preselects the unregistered route',async({page})=>{
 await page.goto('/officers');await page.getByRole('link',{name:'New Application',exact:true}).click();
 await expect(page.getByLabel(/^Application pathway/)).toHaveValue('training');await expect(page.getByLabel(/^PSIRA registration status/)).toHaveValue('not_registered');
 await expect(page.locator('.officers-pathway li')).toHaveCount(6);await expect(page.locator('input[name="psiraNumber"]')).toHaveCount(0);
 await expect(page.getByRole('group',{name:'Training interests — choose at least one'})).toBeVisible();await fits(page);
});
test('registered and renewal applicants share grade, work interests and availability fields',async({page})=>{
 await page.goto('/join?path=registered');await expect(page.getByLabel(/^Application pathway/)).toHaveValue('qualified');
 await expect(page.getByLabel(/^Highest grade/)).toHaveAttribute('required','');
 await expect(page.locator('select[name="psiraGrade"] option')).toHaveCount(6);
 await expect(page.getByRole('group',{name:'Availability — choose at least one'})).toBeVisible();
 await page.getByLabel(/^PSIRA registration status/).selectOption('expired');await expect(page.getByLabel(/^Renewal status/)).toBeVisible();
 await expect(page.getByText(/LOKD can help with PSIRA renewal and refresher training before work is offered/)).toBeVisible();await fits(page);
});
test('each course explains audience, coverage and outcome and opens its booking selection',async({page},testInfo)=>{
 await page.goto('/training');await expect(page.getByRole('heading',{level:1})).toHaveText('Security training at LOKD.');
 const courses=page.locator('.officers-course');await expect(courses).toHaveCount(8);
 const selections=[];
 for(const course of await courses.all()){
  await expect(course.getByText('Who it is for',{exact:true})).toBeVisible();await expect(course.getByText('What it covers',{exact:true})).toBeVisible();await expect(course.getByText('The outcome',{exact:true})).toBeVisible();
  const action=course.getByRole('link',{name:/Book Now/});await expect(action).toHaveText('Book Now');
  const href=await action.getAttribute('href');const url=new URL(href,origin);expect(url.hash).toBe('#training-booking');selections.push([href,url.searchParams.get('course')]);
 }
 await expect(page.locator('.officers-hero').getByRole('link',{name:'Book Now',exact:true})).toHaveAttribute('href','#training-booking');
 await expect(page.locator('main')).not.toContainText('training@lokd.co.za');
 await page.screenshot({path:testInfo.outputPath('training.png'),fullPage:true});
 for(const [href,course] of selections){await page.goto(href);await expect(page.locator('select[name="course"]')).toHaveValue(course);await expect(page.getByRole('heading',{name:'Book your training',exact:true})).toBeInViewport();}
 await fits(page);
});
test('training on Contact leads to the booking form and the shared footer covers South Africa',async({page})=>{
 await page.goto('/contact');
 const training=page.locator('.site-contact-channels').getByRole('link',{name:'Training Book Now'});
 await expect(training).toHaveAttribute('href','/training#training-booking');
 await expect(page.locator('a[href="mailto:training@lokd.co.za"]')).toHaveCount(0);
 await expect(page.locator('.site-footer-location')).toHaveText('South Africa');
 await expect(page.locator('footer').getByRole('link',{name:'Service areas',exact:true})).toHaveAttribute('href','/contact');
 await training.click();await expect(page.getByRole('heading',{name:'Book your training',exact:true})).toBeInViewport();await fits(page);
});
test('training validation retains the form and server rejection keeps the original entries',async({page})=>{
 await page.goto('/training?course=grade-e');await fillBooking(page);await page.getByLabel(/^Mobile number/).fill('123');
 await page.getByRole('button',{name:'Book Now'}).click();await expect(page.getByRole('alert')).toContainText('Enter a South African mobile number');
 await page.getByLabel(/^Mobile number/).fill('0821234567');
 await page.route('**/api/training',route=>route.fulfill({status:400,json:{error:'Choose an available intake month.'}}));
 await page.getByRole('button',{name:'Book Now'}).click();await expect(page.getByRole('alert')).toHaveText('Choose an available intake month.');await expect(page.getByLabel(/^Full name/)).toHaveValue('Browser Applicant');await expect(page.getByRole('button',{name:'Book Now'})).toBeEnabled();
});
test('uncertain training requests retry the identical body and show a saved confirmation',async({page})=>{
 const posts=[];let response={status:503,json:{error:'Your request could not be confirmed.'}};
 await page.route('**/api/training',route=>{posts.push(route.request().postDataJSON());return route.fulfill(response);});
 await page.goto('/training?course=grade-e');await fillBooking(page);await page.getByRole('button',{name:'Book Now'}).click();
 await expect(page.getByRole('alert')).toHaveText('Your request could not be confirmed.');await expect(page.getByLabel(/^Full name/)).toBeDisabled();
 response={status:202,json:{saved:true,reference,teamEmailSent:true,confirmationEmailSent:true}};
 await page.getByRole('button',{name:'Retry original training request'}).click();await expect(page.getByRole('heading',{name:'Your training request is with LOKD.'})).toBeFocused();
 expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0]);await expect(page.locator('.public-form-success dd')).toHaveText(reference);await fits(page);
});
test('a saved training booking with delayed email keeps its reference without inviting an email booking',async({page})=>{
 await page.route('**/api/training',route=>route.fulfill({status:202,json:{saved:true,reference,teamEmailSent:false,confirmationEmailSent:false}}));
 await page.goto('/training?course=grade-e');await fillBooking(page);await page.getByRole('button',{name:'Book Now',exact:true}).click();
 const receipt=page.locator('.public-form-success');
 await expect(receipt.getByRole('heading')).toBeFocused();await expect(receipt.locator('dd')).toHaveText(reference);
 await expect(receipt).toContainText('Your request has been saved');
 await expect(receipt).not.toContainText('training@lokd.co.za');await expect(receipt.locator('a[href^="mailto:"]')).toHaveCount(0);await fits(page);
});
