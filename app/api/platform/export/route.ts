import {env} from 'cloudflare:workers';
import {operationsRequest} from '../../../lib/operations-access';
import {exportProductionPayrollCsv} from '../../../lib/production-payroll';
import {SignupError} from '../../../lib/signup-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 if(!env.DB)throw new SignupError('Payroll storage is unavailable.',503);
 const actor=await operationsRequest(env.DB,request),run=new URL(request.url).searchParams.get('run');
 if(!run||run.length>200)throw new SignupError('Choose a payroll run.');
 return new Response(await exportProductionPayrollCsv(env.DB,actor,run,request.headers),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="lokd-payroll.csv"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}catch(e){return Response.json({error:e instanceof SignupError?e.message:'Payroll export could not be completed.'},{status:e instanceof SignupError?e.status:500,headers:{'cache-control':'private, no-store'}});}}
