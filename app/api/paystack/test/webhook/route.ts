import {blockedTestSurface,rehearsalEnv as env} from '../../../../lib/test-surface-runtime';

import {receivePaystackTest} from '../../../../lib/paystack-test';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
return receivePaystackTest(request,env);}
export async function GET(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
return receivePaystackTest(request,env);}
