import {env} from 'cloudflare:workers';
import {PilotAccessError,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {readOperationalDelivery,runOperationalDelivery} from '../../lib/operational-delivery';
export const dynamic='force-dynamic';
function authorize(request:Request){
 if(!request.headers.get('x-lokd-verified-user-id')||!request.headers.get('x-lokd-verified-email'))throw new PilotAccessError('Sign in to Operations.',401);
 requirePilotApiRole(request,'operations');
}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
const failure=(e:unknown)=>e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Delivery records are temporarily unavailable.'},503);
export async function GET(request:Request){try{authorize(request);if(!env.DB)return reply({error:'Storage unavailable.'},503);return reply({jobs:await readOperationalDelivery(env.DB),enabled:env.LOKD_OPERATIONAL_DELIVERY_ENABLED==='true',scope:'designated_test_sources_and_recipients_only'});}catch(e){return failure(e);}}
export async function POST(request:Request){try{requireSameOriginJson(request);authorize(request);if(!env.DB)return reply({error:'Storage unavailable.'},503);return reply(await runOperationalDelivery(env.DB,env));}catch(e){return failure(e);}}
