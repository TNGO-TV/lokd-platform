import {readRequestText, RequestBodyError} from '../../lib/request-body';
import { env } from "cloudflare:workers";
import { PilotAccessError, pilotStage, principalForEmail, principalHasRole, requirePilotApiRole, requireSameOriginJson } from "../../lib/pilot-runtime";
import { applySpecialistAction, readSpecialistState, specialistDocument, SpecialistWorkflowError } from "../../lib/specialist-operations-server";
import { specialistTerms } from "../../lib/specialist-operations-core";
import type { SpecialistAction, SpecialistEnvironment } from "../../lib/specialist-operations-types";

export const dynamic="force-dynamic";
function reply(payload:unknown,status=200) {return Response.json(payload,{status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer",vary:"x-lokd-verified-email"}});}
function failure(cause:unknown) {
  if(cause instanceof SpecialistWorkflowError||cause instanceof RequestBodyError || cause instanceof PilotAccessError) return reply({error:cause.message},cause.status);
  console.error("specialist_workflow_failed",cause instanceof Error?cause.message:"unknown");
  return reply({error:"The specialist workflow could not complete. Your unsaved inputs are still available; refresh the record and try again."},500);
}
function context(request:Request) {
  const url=new URL(request.url),scope=url.searchParams.get("scope")??"operations";
  if(scope!=="operations"&&scope!=="client"&&scope!=="officer") throw new SpecialistWorkflowError("Choose a valid workspace.");
  const principal=requirePilotApiRole(request,scope);
  // This new workflow never accepts the legacy public-demo fallback as a named reviewer.
  const email=request.headers.get("x-lokd-verified-email");
  if(!email) throw new PilotAccessError("Sign in to access specialist assignment records.",401);
  const assigned=principalForEmail(email);
  if(!principalHasRole(assigned,scope)) throw new PilotAccessError("This account is not assigned to this workspace.",403);
  if(!env.DB) throw new SpecialistWorkflowError("The specialist record store is unavailable.",503);
  const environment:SpecialistEnvironment=pilotStage()==="demo"?"demo":"production";
  return {url,scope:scope as "operations"|"client"|"officer",principal,environment,db:env.DB};
}

export async function GET(request:Request) {
  try {
    const {url,scope,principal,environment,db}=context(request);
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
    const {scope,principal,environment,db}=context(request);
    if(scope!=="operations") throw new PilotAccessError("Only Operations can change specialist records.",403);
    const raw = await readRequestText(request, 100000);
    let action:SpecialistAction; try{action=JSON.parse(raw);}catch{throw new SpecialistWorkflowError("The request must contain valid JSON.");}
    await applySpecialistAction(db,environment,principal.email,action);
    return reply({state:await readSpecialistState(db,environment,principal.email)});
  }catch(cause){return failure(cause);}
}
