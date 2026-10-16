import {test as base,expect} from '@playwright/test';
const origin='http://127.0.0.1:4173';
const test=base.extend({isolatedNetwork:[async({context,page},use,testInfo)=>{
 const posts=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/presence')posts.push(request.postDataJSON());});
 await context.setGeolocation({latitude:-26.176,longitude:28.045});
 await context.grantPermissions(['geolocation'],{origin});
 await use(posts);
 await testInfo.attach('presence-isolation-receipt',{contentType:'application/json',body:Buffer.from(JSON.stringify({syntheticCoordinates:true,inMemoryDatabase:true,syntheticAccount:true,realBrowserGeolocation:true,realComponentAndHandler:true,posts,errors}))});
 expect(errors).toEqual([]);
},{auto:true}]});
const consent=page=>page.getByRole('checkbox');
const share=page=>page.getByRole('button',{name:'Share or refresh live presence'});
const stop=page=>page.getByRole('button',{name:'Stop public sharing'});
const status=page=>page.getByRole('status');
const areas=async page=>(await(await page.request.get('/api/presence')).json()).areas;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

test('served Officer component uses real permitted geolocation, stops and requires fresh consent',async({page,isolatedNetwork:posts})=>{
 const response=await page.goto('/officer?presence-fixture=1');
 expect(response.headers()['permissions-policy']).toContain('geolocation=(self)');
 expect(await page.evaluate(()=>document.featurePolicy.allowsFeature('geolocation'))).toBe(true);
 await consent(page).check();await share(page).click();
 await expect(status(page)).toContainText('Approximate presence shared.');
 expect(posts.find(body=>body.action==='share')).toMatchObject({latitude:-26.2,longitude:28});
 expect(await areas(page)).toHaveLength(1);
 await stop(page).click();await expect(status(page)).toHaveText('Public sharing stopped.');
 expect(await areas(page)).toEqual([]);await expect(consent(page)).not.toBeChecked();await expect(share(page)).toBeDisabled();
 await consent(page).check();await share(page).click();await expect(status(page)).toContainText('Approximate presence shared.');
 expect(await areas(page)).toHaveLength(1);
 await stop(page).click();await expect(status(page)).toHaveText('Public sharing stopped.');
});

test('browser document policy denies geolocation outside Officer pages without dispatching a location',async({page,isolatedNetwork:posts})=>{
 const response=await page.goto('/privacy?presence-fixture=1');
 expect(response.headers()['permissions-policy']).toContain('geolocation=()');
 expect(await page.evaluate(()=>document.featurePolicy.allowsFeature('geolocation'))).toBe(false);
 await consent(page).check();await share(page).click();
 await expect(status(page)).toContainText('Location permission denied or unavailable. Nothing was shared.');
 expect(posts.filter(body=>body.action==='share')).toEqual([]);expect(await areas(page)).toEqual([]);
});

test('Stop during pending state, consent or location HTTP requests cannot revive the served component',async({page})=>{
 for(const action of ['state','start','share']){
  await page.goto('/officer?presence-fixture=1');
  const entered=deferred(),release=deferred(),completed=deferred();
  const intercept=async route=>{
   if(route.request().method()==='POST'&&route.request().postDataJSON().action===action){entered.resolve();await release.promise;await route.continue();completed.resolve();}else await route.continue();
  };
  await page.route('**/api/presence',intercept);
  await consent(page).check();await share(page).click();await entered.promise;
  await stop(page).click();await expect(status(page)).toHaveText('Public sharing stopped.');
  const pendingResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/presence'&&response.request().method()==='POST'&&response.request().postDataJSON().action===action);
  release.resolve();await completed.promise;await(await pendingResponse).finished();
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  await expect(status(page)).toHaveText('Public sharing stopped.');
  expect(await areas(page)).toEqual([]);await expect(consent(page)).not.toBeChecked();await expect(share(page)).toBeDisabled();
  await page.unroute('**/api/presence',intercept);
 }
});
