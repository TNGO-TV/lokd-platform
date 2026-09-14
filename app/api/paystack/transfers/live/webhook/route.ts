import {env} from 'cloudflare:workers';
import {SignupError} from '../../../../../lib/signup-server';
import {receiveLiveTransferWebhook,type PaymentExecutionRuntime} from '../../../../../lib/payment-execution';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{if(!env.DB)throw new SignupError('Storage unavailable.',503);return Response.json(await receiveLiveTransferWebhook(request,env.DB,env as PaymentExecutionRuntime),{headers:{'cache-control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof SignupError?e.message:'Live transfer evidence could not be recorded.'},{status:e instanceof SignupError?e.status:409,headers:{'cache-control':'no-store'}});}
}
