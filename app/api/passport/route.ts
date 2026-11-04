import {env} from 'cloudflare:workers';
import {readRequestText, RequestBodyError} from '../../lib/request-body';
import {PilotAccessError,requireSameOriginJson} from '../../lib/pilot-runtime';
import {readPublicPassport} from '../../lib/passport-server';

export const dynamic='force-dynamic';
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
async function verify(token:unknown,bookingId:unknown,shiftId:unknown){
 if(typeof token!=='string'||!/^lokd_live_[a-f0-9]{64}$/.test(token)||[bookingId,shiftId].some(value=>value!=null&&(typeof value!=='string'||!value.trim()||value.length>300)))return response({error:'Provide a valid LOKD Passport link.'},400);
 if(Boolean(bookingId)!==Boolean(shiftId))return response({error:'Provide both the booking and shift references.'},400);
 if(!env.DB)return response({error:'Passport verification is temporarily unavailable.'},503);
 const passport=await readPublicPassport(env.DB,token,bookingId as string|null,shiftId as string|null);
 if(!passport||passport.synthetic)return response({error:'This LOKD Passport could not be verified.'},404);
 return response({passport});
}
export async function GET(request:Request){try{const url=new URL(request.url);return await verify(url.searchParams.get('token'),url.searchParams.get('booking'),url.searchParams.get('shift'));}catch{return response({error:'Passport verification is temporarily unavailable.'},503);}}
// Verification is read-only. Attendance is recorded in the signed-in Officer workspace.
export async function POST(request:Request){try{
 requireSameOriginJson(request);
 const raw=await readRequestText(request,2000);let body;
 try{body=JSON.parse(raw);}catch{return response({error:'Submit a valid verification request.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['token','bookingId','shiftId'].includes(key)))return response({error:'Submit a valid verification request.'},400);
 return await verify(body.token,body.bookingId,body.shiftId);
}catch(error){return error instanceof RequestBodyError||error instanceof PilotAccessError?response({error:error.message},error.status):response({error:'Passport verification is temporarily unavailable.'},503);}}
