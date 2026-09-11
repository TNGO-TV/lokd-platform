import { hasLinkedOfficerSignup } from '../../lib/signup-server';
import { principalForEmail, principalHasRole } from '../../lib/pilot-runtime';
import { workspaceRoleForHost } from '../../lib/public-site';
import { env } from 'cloudflare:workers';
import { PilotAccessError, requirePilotApiRole, requireSameOriginJson } from '../../lib/pilot-runtime';
import { PsiraError } from '../../lib/psira-verification';
import { readPsiraCases, writePsiraCase } from '../../lib/psira-server';
export const dynamic = 'force-dynamic';
async function actor(request: Request) {
  // This workflow stores real evidence: public demo fallback is never sufficient.
  const userId = request.headers.get('x-lokd-verified-user-id');
  const email = request.headers.get('x-lokd-verified-email');
  if (!userId || !email) throw new PsiraError('Sign in to access your registration verification.',401);
  const scope = new URL(request.url).searchParams.get('scope');
  if (scope !== 'officer' && scope !== 'operations') throw new PsiraError('Choose the Officer or Operations workspace.');
  const hostRole=workspaceRoleForHost(new URL(request.url).hostname);
  if(hostRole && hostRole!==scope)throw new PsiraError('Open the correct workspace.',403);
  const assigned=principalHasRole(principalForEmail(email),scope);
  if(scope==='operations'||assigned) {
    if(!assigned)throw new PsiraError('This account is not assigned to that workspace.',403);
    requirePilotApiRole(request,scope);
  } else if(!env.DB || !await hasLinkedOfficerSignup(env.DB,userId)) {
    throw new PsiraError('Link your officer application before requesting registration verification.',403);
  }
  return { userId, email, operations: scope === 'operations' };
}
function response(value: unknown, status = 200) { return Response.json(value,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}}); }
function failure(error: unknown) { return error instanceof PsiraError || error instanceof PilotAccessError ? response({error:error.message},error.status) : response({error:'Verification records are temporarily unavailable. No verification was granted.'},503); }
export async function GET(request: Request) {
  try { const principal=await actor(request); if (!env.DB) throw new PsiraError('Verification storage is unavailable.',503); return response({cases:await readPsiraCases(env.DB,principal)}); } catch(error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOriginJson(request); const principal=await actor(request);
    const text=await request.text(); if(text.length>14000) throw new PsiraError('The evidence submission is too large.',413);
    let body; try{body=JSON.parse(text);}catch{throw new PsiraError('Submit a valid verification form.');}
    if (!body || typeof body!=='object' || Array.isArray(body)) throw new PsiraError('Submit a valid verification form.');
    if (!env.DB) throw new PsiraError('Verification storage is unavailable.',503);
    await writePsiraCase(env.DB,principal,body);return response({cases:await readPsiraCases(env.DB,principal)});
  }catch(error){return failure(error);}
}
