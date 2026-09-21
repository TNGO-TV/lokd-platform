import {env} from 'cloudflare:workers';
import {receiveBookingCollectionWebhook} from '../../../../lib/booking-collections';
import {SignupError} from '../../../../lib/signup-server';
export async function POST(request:Request){
 try{if(!env.DB)throw new SignupError('Storage unavailable.',503);const mode=new URL(request.url).searchParams.get('mode');if(mode!=='test'&&mode!=='live')throw new SignupError('Explicit provider mode required.',422);return Response.json(await receiveBookingCollectionWebhook(request,env.DB,env,mode),{headers:{'cache-control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof SignupError?e.message:'Event storage unavailable. Retry delivery.'},{status:e instanceof SignupError?e.status:503,headers:{'cache-control':'no-store'}});}
}
