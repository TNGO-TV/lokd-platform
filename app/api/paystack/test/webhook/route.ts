import {env} from 'cloudflare:workers';
import {receivePaystackTest} from '../../../../lib/paystack-test';
export const dynamic='force-dynamic';
export async function POST(request:Request){return receivePaystackTest(request,env);}
export async function GET(request:Request){return receivePaystackTest(request,env);}
