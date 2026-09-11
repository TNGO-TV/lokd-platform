// Retain historical rehearsal code/tests, but never expose synthetic operational
// records as a live service. Enable each capability only after live acceptance.
const unavailable=new Set(['/api/pilot','/api/operations','/api/platform','/api/platform/export','/api/onboarding','/api/specialist','/api/passport','/api/evidence','/api/service-record','/api/feedback']);
export function liveSurfaceResponse(pathname:string,stage:unknown,authenticated=false,method="GET"):Response|null {
 const path=pathname.replace(/\/$/,'');
 const blocked=unavailable.has(path)||(path==='/api/applications'&&method!=='POST');
 if(stage==='demo'||!blocked)return null;
 if(!authenticated && path!=='/api/passport')return Response.json({error:'Sign in to continue.'},{status:401,headers:{'cache-control':'private, no-store'}});
 return Response.json({error:'This service is not available yet. Applications and enquiries are open through your account.'},{status:423,headers:{'cache-control':'private, no-store'}});
}
