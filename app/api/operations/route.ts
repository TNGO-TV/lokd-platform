import {env} from 'cloudflare:workers';
import {operationsRequest,requireOperationsJson} from '../../lib/operations-access';
import {readOperationsWorkspace} from '../../lib/operations-workspace';
import {operateProduction} from '../../lib/production-operations';
import {SignupError} from '../../lib/signup-server';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const failure=(e:unknown)=>reply({error:e instanceof SignupError||e instanceof RequestBodyError?e.message:'The Operations request could not be completed. Refresh the record before retrying.'},e instanceof SignupError||e instanceof RequestBodyError?e.status:500);
export async function GET(request:Request){try{if(!env.DB)throw new SignupError('Operations storage is unavailable.',503);const actor=await operationsRequest(env.DB,request);return reply({state:await readOperationsWorkspace(env.DB,actor,new URL(request.url).searchParams.get("before"))});}catch(e){return failure(e);}}
export async function POST(request:Request){try{requireOperationsJson(request);if(!env.DB)throw new SignupError('Operations storage is unavailable.',503);const actor=await operationsRequest(env.DB,request);let input;try{input=JSON.parse(await readRequestText(request,24000));}catch(e){if(e instanceof RequestBodyError)throw e;throw new SignupError('Send a valid JSON object.');}if(!input||Array.isArray(input)||typeof input!=='object'||typeof input.action!=='string')throw new SignupError('Choose an Operations action.');return reply({result:await operateProduction(env.DB,actor,input,request.headers,false,env),state:await readOperationsWorkspace(env.DB,actor)});}catch(e){return failure(e);}}
