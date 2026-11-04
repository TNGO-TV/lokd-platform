import {env} from 'cloudflare:workers';
import {reverificationError} from '@clerk/backend/internal';
import {operationsRequest} from '../../../lib/operations-access';
import {operationsMfaStatus} from '../../../lib/operations-mfa';
import {SignupError} from '../../../lib/signup-server';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
 try {
  if(!request.headers.get('x-lokd-verified-user-id'))throw new SignupError('Sign in to continue.',401);
  if(!env.DB)throw new SignupError('Operations storage is unavailable.',503);
  await operationsRequest(env.DB,request,true);
  const state={...operationsMfaStatus(request.headers),required:true};
  if(new URL(request.url).searchParams.get('verify')==='1'&&!state.fresh){
   if(!state.enrolled)return reply({error:'Enrol an authenticator in Account security first.',...state},403);
   return reply(reverificationError({level:'second_factor',afterMinutes:4}),403);
  }
  return reply(state);
 }catch(error){return reply({error:error instanceof SignupError?error.message:'Security status is unavailable.'},error instanceof SignupError?error.status:503);}
}
