import {readRequestText, RequestBodyError} from '../../../lib/request-body';
import {env} from 'cloudflare:workers';
import {PilotAccessError,requireSameOriginJson} from '../../../lib/pilot-runtime';
import {readPublicPassport} from '../../../lib/passport-server';

export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}});
// Read-only bearer verification. New private-delivery clients send the token in
// this body, never a server-visible URL. This performs no arrival/scan mutation.
export async function POST(request:Request){
 try{
  requireSameOriginJson(request);
  const raw = await readRequestText(request, 2000);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid verification request.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['token','bookingId','shiftId'].includes(k))||typeof body.token!=='string'||!/^lokd_live_[a-f0-9]{64}$/.test(body.token)||['bookingId','shiftId'].some(k=>body[k]!=null&&(typeof body[k]!=='string'||!body[k].trim()||body[k].length>300)))return reply({error:'Provide a valid private passport token and optional assignment references.'},400);
  if(!env.DB)return reply({error:'Passport verification is unavailable.'},503);
  const passport=await readPublicPassport(env.DB,body.token,body.bookingId,body.shiftId);
  return passport?reply({passport}):reply({error:'This passport is unavailable or no longer current.'},404);
 }catch(error){return error instanceof RequestBodyError || error instanceof PilotAccessError?reply({error:error.message},error.status):reply({error:'Passport verification is unavailable.'},503);}
}
