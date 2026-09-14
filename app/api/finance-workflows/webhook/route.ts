import {readFinanceBody,financeSandboxDatabase} from '../../../lib/finance-workflow-request';
import {env} from 'cloudflare:workers';
import {acceptFinanceWebhook} from '../../../lib/finance-workflow-provider';
import {sandbox,type FinanceRuntime} from '../../../lib/finance-workflow-store';
import {SignupError} from '../../../lib/signup-server';
export async function POST(request:Request){try{const runtime=env as unknown as FinanceRuntime;sandbox(runtime);if(!runtime.FINANCE_SIMULATOR_KEY)throw new SignupError('Simulator webhook unavailable.',423);const db=await financeSandboxDatabase(env);return Response.json(await acceptFinanceWebhook(db,runtime,await readFinanceBody(request,20000),request.headers.get('x-paystack-signature')??''),{headers:{'cache-control':'no-store'}});}catch(e){return Response.json({error:e instanceof SignupError?e.message:'Evidence rejected.'},{status:e instanceof SignupError?e.status:409});}}
