import {env} from 'cloudflare:workers';
import {operationsRequest,requireOperationsJson as requireSameOriginJson} from '../../lib/operations-access';
import {SignupError} from '../../lib/signup-server';
import {workspaceRoleForHost} from '../../lib/public-site';
import {readRequestText, RequestBodyError} from '../../lib/request-body';


import { applySpecialistAction, readSpecialistState, specialistDocument, SpecialistWorkflowError } from "../../lib/specialist-operations-server";
import { specialistTerms } from "../../lib/specialist-operations-core";
import type { SpecialistAction, SpecialistEnvironment } from "../../lib/specialist-operations-types";

export const dynamic="force-dynamic";
function reply(payload:unknown,status=200) {return Response.json(payload,{status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer",vary:"x-lokd-verified-email"}});}
function failure(cause:unknown) {
  if(cause instanceof SpecialistWorkflowError||cause instanceof RequestBodyError || cause instanceof SignupError) return reply({error:cause.message},cause.status);
  console.error("specialist_workflow_failed",cause instanceof Error?cause.message:"unknown");
  return reply({error:"The specialist workflow could not complete. Your unsaved inputs are still available; refresh the record and try again."},500);
}
async function context(request:Request) {
 const url=new URL(request.url),scope=url.searchParams.get('scope')??'operations';
 if(scope!=='operations'&&scope!=='client'&&scope!=='officer')throw new SignupError('Choose a valid workspace.');
 if(!env.DB)throw new SignupError('Specialist storage is unavailable.',503);
 const host=workspaceRoleForHost(url.hostname);if(host&&host!==scope)throw new SignupError('Open the correct workspace.',403);
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
 if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 const operator=scope==='operations'?await operationsRequest(env.DB,request):null;
 const linked=scope==='operations'?null:await env.DB.prepare("SELECT l.entity_id FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.owner_user_id=l.owner_user_id AND c.version=l.case_version WHERE l.kind=? AND l.owner_user_id=? AND c.status!='withdrawn'").bind(scope,userId).first<{entity_id:string}>();
 if(!operator&&!linked)throw new SignupError('A current linked account is required.',403);
 return {url,scope:scope as 'operations'|'client'|'officer',principal:{email,clientId:scope==='client'?linked!.entity_id:null,officerId:scope==='officer'?linked!.entity_id:null},operator,environment:'production' as SpecialistEnvironment,db:env.DB};
}

export async function GET(request:Request) {


  try {
    const {url,scope,principal,environment,db}=await context(request);
    const state=await readSpecialistState(db,environment,principal.email);
    if(scope==="operations" && !url.searchParams.has("pack")) return reply({state});
    const accessible=state.packs.filter(pack=>{
      if(scope==="operations") return true;
      const booking=state.bookings.find(b=>b.id===pack.bookingId);
      if(pack.status!=="approved"||pack.blockers.length) return false;
      return scope==="client"?!!principal.clientId&&booking?.clientId===principal.clientId:!!principal.officerId&&pack.content.officerIds.includes(principal.officerId);
    });
    const documents=accessible.map(pack=>specialistDocument(state,pack,scope));
    const packId=url.searchParams.get("pack");
    if(packId) {
      const document=documents.find(d=>d.packId===packId);
      if(!document) throw new SpecialistWorkflowError("This assignment document is not available to your account.",404);
      if(url.searchParams.get("download")==="1") {
        const lines=[document.banner,"LOKD SPECIALIST SERVICE PACK",...Object.entries(document).filter(([key])=>key!=="banner").map(([key,value])=>`${key}: ${typeof value==="object"?JSON.stringify(value,null,2):String(value)}`),scope==="officer"?"":`\nCOMMERCIAL TERMS\n${Object.entries(specialistTerms).filter(([,value])=>typeof value==="string").map(([key,value])=>`${key}: ${value}`).join("\n\n")}`];
        return new Response(lines.join("\n\n"),{headers:{"content-type":"text/plain; charset=utf-8","content-disposition":`attachment; filename="LOKD-specialist-pack-${packId.replace(/[^a-zA-Z0-9_-]/g,"")}-${scope}.txt"`,"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
      }
      return reply({document});
    }
    return reply({documents});
  }catch(cause){return failure(cause);}
}

export async function POST(request:Request) {


  try {
    requireSameOriginJson(request);
    const {scope,principal,environment,db,operator}=await context(request);
    if(scope!=="operations") throw new SignupError("Only Operations can change specialist records.",403);
    const raw = await readRequestText(request, 100000);
    let action:SpecialistAction; try{action=JSON.parse(raw);}catch{throw new SpecialistWorkflowError("The request must contain valid JSON.");}
    if(!operator)throw new SignupError('Operations access required.',403);
    await applySpecialistAction(db,environment,principal.email,action,{actor:operator,headers:request.headers});
    return reply({state:await readSpecialistState(db,environment,principal.email)});
  }catch(cause){return failure(cause);}
}
