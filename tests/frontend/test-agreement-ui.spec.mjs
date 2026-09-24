import {test,expect} from '@playwright/test';
// UI-only response fixtures. These tests do not prove Clerk or provider acceptance.
const envelope=()=>({id:'TA-UI-1',document_version:'test-client-v1',state:'issued',revision:1,content_hash:'exact-content',context_hash:'exact-context',wording:'LOKD TEST AGREEMENT — NOT A LIVE CONTRACT. Synthetic UI fixture only.',note:'Synthetic issue evidence.',expires_at:'2099-01-01T00:00:00Z',usable:true,stale:false});
async function setup(page,{operations=false,documents=[]}={}){
 const state={data:{caseVersion:2,withdrawn:false,documents,events:[]},posts:[],failure:0,readFailure:0};
 await page.addInitScript(()=>{window.prompt=()=>{throw Error('prompt unavailable');};window.confirm=()=>{throw Error('confirm unavailable');};});
 await page.route('**/api/signup?**',route=>route.fulfill({json:{email:operations?'ops@example.test':'client@example.test',hasMore:false,records:[{id:'ENQ-UI',kind:'client',email:'client@example.test',accountLinked:true,version:2,status:'reviewed',details:{organisationName:'Synthetic UI client'},createdAt:'2026-09-24T12:00:00Z',updatedAt:'2026-09-24T12:00:00Z',note:'Synthetic intake reviewed.',events:[]}]}}));
 await page.route('**/api/agreements/test?**',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();state.posts.push(body);
   if(state.failure){await route.fulfill({status:state.failure,json:{error:'Synthetic request failure; input retained.'}});return;}
   const doc=state.data.documents[0]??envelope();
   if(body.action==='sign')doc.state='signed_test';
   if(body.action==='review')doc.state='reviewed_test';
   if(body.action==='cancel'){doc.state='cancelled';doc.usable=false;}
   if(body.action!=='issue')doc.revision++;
   state.data.documents=[doc];
  }else if(state.readFailure){await route.fulfill({status:state.readFailure,json:{error:'Synthetic access revoked.'}});return;}
  await route.fulfill({json:state.data});
 });
 await page.goto(operations?'/ops?kind=client':'/client');
 await page.getByRole('button',{name:'Open test documents',exact:true}).click();
 await expect(page.getByRole('button',{name:'Refresh test documents',exact:true})).toBeEnabled();
 return state;
}
test('issue form dismisses without mutation and retains failed draft for a deliberate retry',async({page})=>{
 const state=await setup(page,{operations:true});
 await page.getByRole('button',{name:'Issue or retrieve test agreement',exact:true}).click();
 await page.getByLabel('Why are you issuing this test agreement?').fill('Synthetic issue for UI regression.');
 await page.getByRole('button',{name:'Close form without saving',exact:true}).click();
 expect(state.posts).toHaveLength(0);
 await page.getByRole('button',{name:'Issue or retrieve test agreement',exact:true}).click();
 const input=page.getByLabel('Why are you issuing this test agreement?');
 await expect(input).toHaveValue('');
 await input.fill('             ');
 await page.getByRole('button',{name:'Confirm test agreement issue',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('12 to 1200');
 expect(state.posts).toHaveLength(0);
 await input.fill('Synthetic issue for UI regression.');state.failure=503;
 await page.getByRole('button',{name:'Confirm test agreement issue',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('input retained');
 await expect(input).toHaveValue('Synthetic issue for UI regression.');
 state.failure=0;
 await page.getByRole('button',{name:'Confirm test agreement issue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'test-client-v1',exact:true})).toBeVisible();
 expect(state.posts).toHaveLength(2);
 expect(state.posts[1]).toMatchObject({action:'issue',caseId:'ENQ-UI',caseVersion:2,note:'Synthetic issue for UI regression.',identityAndAuthorityReviewed:false});
 await expect(page.getByRole('form',{name:'Issue or retrieve test agreement',exact:true})).toHaveCount(0);
});
test('signing requires explicit acknowledgement and posts the displayed revision and hashes once',async({page})=>{
 const state=await setup(page,{documents:[envelope()]});
 await page.getByText('Read exact test document',{exact:true}).click();
 await expect(page.getByText(/LOKD TEST AGREEMENT — NOT A LIVE CONTRACT/)).toBeVisible();
 await page.getByRole('button',{name:'Sign test agreement',exact:true}).click();
 await page.getByLabel('Your name for this test signing record').fill('Synthetic UI signer');
 const ack=page.getByRole('checkbox');await expect(ack).not.toBeChecked();
 await page.getByRole('button',{name:'Record test signature',exact:true}).click();
 expect(state.posts).toHaveLength(0);
 await ack.check();
 await page.getByRole('button',{name:'Record test signature',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'signed test'})).toBeVisible();
 expect(state.posts).toEqual([{action:'sign',caseId:'ENQ-UI',caseVersion:2,envelopeId:'TA-UI-1',expectedRevision:1,signerName:'Synthetic UI signer',affirmative:true,testAcknowledged:true,contentHash:'exact-content',contextHash:'exact-context'}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('review acknowledgement stays explicit and cancellation keeps the exact revised document',async({page})=>{
 const state=await setup(page,{operations:true,documents:[{...envelope(),state:'signed_test',revision:2}]});
 await page.getByRole('button',{name:'Review test signature',exact:true}).click();
 await page.getByLabel('Test signer identity and authority evidence reviewed').fill('Fictional identity evidence in this UI fixture only.');
 const ack=page.getByRole('checkbox');await expect(ack).not.toBeChecked();
 await page.getByRole('button',{name:'Save test signature review',exact:true}).click();expect(state.posts).toHaveLength(0);
 await ack.check();await page.getByRole('button',{name:'Save test signature review',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'reviewed test'})).toBeVisible();
 expect(state.posts[0]).toMatchObject({action:'review',expectedRevision:2,identityAndAuthorityReviewed:true});
 await page.getByRole('button',{name:'Cancel test document',exact:true}).click();
 await page.getByLabel('Why is this test document being cancelled?').fill('Synthetic cancellation to verify revision binding.');
 await page.getByRole('button',{name:'Confirm test document cancellation',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'cancelled'})).toBeVisible();
 expect(state.posts[1]).toMatchObject({action:'cancel',envelopeId:'TA-UI-1',expectedRevision:3,identityAndAuthorityReviewed:false});
});
test('refresh discards an old signing draft and access loss removes private document data',async({page})=>{
 const state=await setup(page,{documents:[envelope()]});
 await page.getByRole('button',{name:'Sign test agreement',exact:true}).click();
 await page.getByLabel('Your name for this test signing record').fill('Private draft signer');
 state.data={...state.data,caseVersion:3,documents:[{...envelope(),id:'TA-UI-2',revision:4,content_hash:'replacement-content',context_hash:'replacement-context'}]};
 await page.getByRole('button',{name:'Refresh test documents',exact:true}).click();
 await expect(page.getByLabel('Your name for this test signing record')).toHaveCount(0);
 await page.getByRole('button',{name:'Sign test agreement',exact:true}).click();
 await expect(page.getByLabel('Your name for this test signing record')).toHaveValue('');
 await expect(page.getByRole('checkbox')).not.toBeChecked();
 state.readFailure=403;
 await page.getByRole('button',{name:'Refresh test documents',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('access revoked');
 await expect(page.getByRole('heading',{name:'test-client-v1',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Your name for this test signing record')).toHaveCount(0);
 expect(state.posts).toHaveLength(0);
});
