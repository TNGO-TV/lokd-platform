import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
import {quoteActor,requireClientJson} from '../../lib/quote-access';
import {readClientAgreements,acceptClientAgreement,clientAgreementCopy} from '../../lib/agreement-client';
import {deliverClientNotifications} from '../../lib/quote-notifications';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers});
const failure=(error:unknown)=>error instanceof SignupError||error instanceof RequestBodyError?reply({error:error.message},error.status):reply({error:'Your agreement could not be updated. Refresh and try again.'},409);
export async function GET(request:Request){try{
 const actor=quoteActor(request,env);if(actor.operations)throw new SignupError('Open your client account.',403);
 if(!env.DB)throw new SignupError('Agreement storage is unavailable.',503);
 const id=new URL(request.url).searchParams.get('receipt');
 if(id)return new Response(await clientAgreementCopy(env.DB,actor,id),{headers:{...headers,'content-type':'text/html; charset=utf-8','content-disposition':'inline','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
 return reply(await readClientAgreements(env.DB,actor,new URL(request.url).searchParams.get('agreement')??undefined));
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 requireClientJson(request);const actor=quoteActor(request,env);if(actor.operations)throw new SignupError('Open your client account.',403);
 if(!env.DB)throw new SignupError('Agreement storage is unavailable.',503);
 let input;try{input=JSON.parse(await readRequestText(request,5000));}catch(error){if(error instanceof RequestBodyError)throw error;throw new SignupError('Enter a valid agreement request.');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Enter a valid agreement request.');
 const result=await acceptClientAgreement(env.DB,actor,input);
 const emailDelivery=await deliverClientNotifications(env.DB,env,{ownerUserId:actor.userId,ids:[`agreement:accepted:client:${input.envelopeId}`,`agreement:accepted:operations:${input.envelopeId}`]});
 return reply({result,emailDelivery,...await readClientAgreements(env.DB,actor,new URL(request.url).searchParams.get('agreement')??undefined)});
}catch(error){return failure(error);}}
