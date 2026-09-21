import {readRequestText, RequestBodyError} from '../../lib/request-body';
import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,requireSameOriginJson} from '../../lib/pilot-runtime';
import {applicantApiActor,applicantSubject} from '../../lib/applicant-api-access';
import {readTestEnrolment,initializeTestEnrolment,reconcileTestEnrolment} from '../../lib/test-enrolment';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
const fail=(e:unknown)=>e instanceof SignupError||e instanceof RequestBodyError || e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Test enrolment unavailable. No payment approval granted.'},503);
export async function GET(request:Request){try{const ops=new URL(request.url).searchParams.get('scope')==='operations';const actor=applicantApiActor(request,ops);const id=new URL(request.url).searchParams.get('caseId');if(!env.DB||!id||id.length>100)throw new SignupError('Choose a linked application.');return reply(await readTestEnrolment(env.DB,ops?await applicantSubject(env.DB,id):actor.id,id));}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 requireSameOriginJson(request);const ops=new URL(request.url).searchParams.get('scope')==='operations';const actor=applicantApiActor(request,ops);const raw = await readRequestText(request, 2000);let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.caseId!=='string')throw new SignupError('Choose a valid application.');
 if(body.action==='initialize'){if(ops)throw new SignupError('The applicant must open their own test checkout.',403);if(body.testAcknowledged!==true)throw new SignupError('Acknowledge this is a test-only checkout.');return reply(await initializeTestEnrolment(env,actor.id,actor.email,body));}
 if(body.action==='reconcile'){if(!env.DB)throw new SignupError('Storage unavailable.',503);return reply(await reconcileTestEnrolment(env,ops?await applicantSubject(env.DB,body.caseId):actor.id,body));}
 throw new SignupError('Choose a valid payment action.');
 }catch(e){return fail(e);}}
