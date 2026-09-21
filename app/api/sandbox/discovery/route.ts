import {env} from 'cloudflare:workers';
import {SignupError} from '../../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole} from '../../../lib/pilot-runtime';
import {sandboxDiscovery} from '../../../lib/sandbox-discovery';
import type {SandboxRuntime} from '../../../lib/sandbox-completion-policy';
export const dynamic='force-dynamic';
export async function GET(request:Request){const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};try{const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in.',401);const p=principalForEmail(email),operations=principalHasRole(p,'operations');if(operations)requirePilotApiRole(request,'operations');return Response.json(await sandboxDiscovery(env as unknown as SandboxRuntime,{userId,email,operations,owner:operations&&p.owner},new URL(request.url).searchParams),{headers});}catch(e){return Response.json({error:e instanceof SignupError||e instanceof PilotAccessError?e.message:'Sandbox discovery unavailable.'},{status:e instanceof SignupError||e instanceof PilotAccessError?e.status:409,headers});}}
