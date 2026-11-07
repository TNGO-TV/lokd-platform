import {workspaceCommandReceipt} from '../../lib/workspace-command-receipt';
import {env} from 'cloudflare:workers';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
import {SignupError} from '../../lib/signup-server';
import {OfficerAccessError,officerApiActor,requireOfficerJson} from '../../lib/officer-api-access';
import {AssignmentActivationError} from '../../lib/assignment-activation-server';
import {deliverOfficerEmail} from '../../lib/officer-email';
import type {OfficerEmailRuntime} from '../../lib/officer-email';
import {readOnboardingState} from '../../lib/onboarding-server';
import {readOfficerWork,writeOfficerWork} from '../../lib/officer-work';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
function actor(request:Request){const scope=new URL(request.url).searchParams.get('scope');if(scope&&scope!=='officer')throw new SignupError('Open your Officer workspace.',403);return officerApiActor(request);}
function fail(error:unknown){return error instanceof SignupError||error instanceof RequestBodyError||error instanceof OfficerAccessError||error instanceof AssignmentActivationError?reply({error:error.message},error.status):reply({error:'Your officer records are temporarily unavailable. Please try again.'},503);}
export async function GET(request:Request){try{const a=actor(request);if(!env.DB)throw new SignupError('Officer storage is unavailable.',503);return reply({state:await readOfficerWork(env.DB,a),onboarding:await readOnboardingState(env.DB,'officer',a)});}catch(error){return fail(error);}}
export async function POST(request:Request){try{requireOfficerJson(request);const a=actor(request);if(!env.DB)throw new SignupError('Officer storage is unavailable.',503);const raw=await readRequestText(request,4000);let input;try{input=JSON.parse(raw);}catch{throw new SignupError('Submit a valid officer form.');}if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Submit a valid officer form.');const result=await writeOfficerWork(env.DB,a,input);const notification='emailId' in result&&typeof result.emailId==='string'?await deliverOfficerEmail(env.DB,env as unknown as OfficerEmailRuntime,result.emailId):undefined;return reply({result:{...result,notification},commandReceipt:await workspaceCommandReceipt('officer-work',input),state:await readOfficerWork(env.DB,a)});}catch(error){return fail(error);}}
