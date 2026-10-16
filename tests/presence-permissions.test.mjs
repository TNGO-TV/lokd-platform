import assert from 'node:assert/strict';
import test from 'node:test';
import {secureRequest,secureResponse} from '../app/lib/security-headers.ts';
test('geolocation is limited to Officer HTML; forwarded hosts, unrelated routes and downloads cannot enable it',()=>{
 for(const host of ['officers.lokd.co.za','lokd.co.za','portal.lokd.co.za','operations.lokd.co.za','localhost','127.0.0.1','demo.lokd.co.za'])for(const route of ['/officer','/officer/','/signup','/signup?kind=client','/privacy','/api/presence']){
  const secured=secureRequest(new Request('https://'+host+route,{headers:{host:'officers.lokd.co.za','x-forwarded-host':'officers.lokd.co.za'}}));
  const hostAllowed=['officers.lokd.co.za','localhost','127.0.0.1','demo.lokd.co.za'].includes(host);
  const allowed=hostAllowed&&(['/officer','/officer/','/signup'].includes(route)||host==='officers.lokd.co.za'&&route==='/signup?kind=client');
  for(const type of ['html','json','attachment']){
   const headers={'content-type':type==='json'?'application/json':'text/html',...(type==='attachment'?{'content-disposition':'attachment'}:{})};
   const response=secureResponse(new Response('',{headers}),secured.policy,secured.request);
   assert.equal(response.headers.get('permissions-policy').includes('geolocation=(self)'),allowed&&type==='html',`${host}${route}/${type}`);
   assert.match(response.headers.get('permissions-policy'),/camera=\(\), microphone=\(\)/);
  }
 }
});
