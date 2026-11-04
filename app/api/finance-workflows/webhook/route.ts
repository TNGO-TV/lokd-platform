import {env} from 'cloudflare:workers';
import {receiveLiveTransferWebhook,type PaymentExecutionRuntime} from '../../../lib/payment-execution';
import {SignupError} from '../../../lib/signup-server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const runtime=env as PaymentExecutionRuntime;
 if(!runtime.PAYSTACK_LIVE_SECRET_KEY)return Response.json({error:'Payment provider webhooks are not connected.'},{status:503,headers:{'cache-control':'no-store'}});
 try{if(!env.DB)throw new SignupError('Payment storage is unavailable.',503);return Response.json(await receiveLiveTransferWebhook(request,env.DB,runtime),{headers:{'cache-control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof SignupError?e.message:'The payment event could not be verified.'},{status:e instanceof SignupError?e.status:400,headers:{'cache-control':'no-store'}});}
}
