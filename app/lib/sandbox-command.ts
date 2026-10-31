import {SignupError,type SignupActor} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
export const sandboxCommandScopes=['capture','officer_application','client_enquiry','import_finance'] as const;
export type SandboxCommandScope=typeof sandboxCommandScopes[number];
const canonical=(v:unknown):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(canonical(x))])):v);
export function commandKey(v:unknown){if(typeof v!=='string'||! /^[A-Za-z0-9][A-Za-z0-9:_-]{7,159}$/.test(v))throw new SignupError('Use the original bounded request key.');return v;}
export async function readSandboxCommand(runtime:SandboxRuntime,a:SignupActor,scope:string,key:string){
 const {db}=await requireSandboxCompletion(runtime);if(!sandboxCommandScopes.includes(scope as SandboxCommandScope))throw new SignupError('Unknown command scope.');commandKey(key);
 const row=await db.prepare('SELECT c.request_key,c.scope,r.result_json FROM sandbox_command_claims c LEFT JOIN sandbox_command_receipts r ON r.command_id=c.id WHERE c.owner_user_id=? AND c.scope=? AND c.request_key=?').bind(a.userId,scope,key).first<{request_key:string;scope:string;result_json:string|null}>();
 if(!row)throw new SignupError('Original request not found.',404);const result=row.result_json?JSON.parse(row.result_json):null;const failure=result?.sandboxCommandFailure??null;return {requestKey:key,scope,status:failure?'failed':row.result_json?'completed':'pending',recorded:!!row.result_json,failure,result:failure?null:result};
}
// Journal the target source INSERT and its recovery receipt in the same D1 batch.
// A durable claim is never re-executed after uncertainty, even if no receipt exists.
export async function executeSandboxCommand(runtime:SandboxRuntime,a:SignupActor,scope:SandboxCommandScope,key:unknown,input:Record<string,unknown>,execute:(runtime:SandboxRuntime,db:D1Database)=>Promise<unknown>){
 const {db,policyHash}=await requireSandboxCompletion(runtime),requestKey=commandKey(key),digest=await agreementHash(canonical({scope,input,policyHash}));
 const prior=await db.prepare('SELECT id,digest FROM sandbox_command_claims WHERE owner_user_id=? AND scope=? AND request_key=?').bind(a.userId,scope,requestKey).first<{id:string;digest:string}>();
 if(prior){if(prior.digest!==digest)throw new SignupError('Original request key belongs to different input or policy.',409);return readSandboxCommand(runtime,a,scope,requestKey);}
 const id=crypto.randomUUID();try{await db.prepare('INSERT INTO sandbox_command_claims VALUES(?,?,?,?,?,?,?)').bind(id,a.userId,scope,requestKey,digest,policyHash,new Date().toISOString()).run();}catch(e){const winner=await db.prepare('SELECT digest FROM sandbox_command_claims WHERE owner_user_id=? AND scope=? AND request_key=?').bind(a.userId,scope,requestKey).first<{digest:string}>();if(!winner)throw e;if(winner.digest!==digest)throw new SignupError('Original request key belongs to different input.',409);return readSandboxCommand(runtime,a,scope,requestKey);}
 const target={capture:'sandbox_identity_captures',officer_application:'officer_applications',client_enquiry:'client_enquiries',import_finance:'sandbox_training_entitlements'}[scope];
 type Meta={real:D1PreparedStatement;sql:string;args:unknown[]};const metadata=new WeakMap<object,Meta>();let recorded=false,writeAttempted=false;
 const receipt=(m:Meta)=>{const v=m.args;let result:unknown;
 if(scope==='capture')result={captureReference:v[0],consentVersion:v[4],expiresAt:v[9],mode:'simulator',policyVersion:v[5]};
 else if(scope==='import_finance')result={entitlementId:v[0],course:v[4],courseVersion:v[5],qualified:false,workEligible:false,mode:'simulator'};
 // This receipt is committed in the same batch as the target source INSERT.
 // Neutral/no-write responses use the execute result below and never gain saved.
 else result=scope==='client_enquiry'?{saved:true,reference:v[0]}:{saved:true,reference:v[0],psiraVerificationRequired:['active','expired'].includes(String(input.psiraStatus)),pathwayStatus:v[15]};
 return db.prepare('INSERT INTO sandbox_command_receipts VALUES(?,?,?)').bind(id,JSON.stringify(result),new Date().toISOString());};
 const commit=async(statements:D1PreparedStatement[])=>{writeAttempted=true;const rows=statements.map(s=>metadata.get(s)??{real:s,sql:'',args:[]}),match=rows.find(m=>new RegExp('^\\s*INSERT\\s+INTO\\s+'+target+'\\b','i').test(m.sql));const result=await db.batch([...rows.map(m=>m.real),...(match?[receipt(match)]:[])]);if(match)recorded=true;return result.slice(0,rows.length);};
 const wrap=(sql:string,args:unknown[]=[]):D1PreparedStatement=>{const real=args.length?db.prepare(sql).bind(...args):db.prepare(sql);const statement:D1PreparedStatement=new Proxy(real,{get(t,k){if(k==='bind')return(...values:unknown[])=>wrap(sql,values);if(k==='run')return async()=> (await commit([statement]))[0];const value=Reflect.get(t,k);return typeof value==='function'?value.bind(t):value;}});metadata.set(statement,{real,sql,args});return statement;};
 const proxy=new Proxy(db,{get(t,k){if(k==='prepare')return wrap;if(k==='batch')return commit;const value=Reflect.get(t,k);return typeof value==='function'?value.bind(t):value;}}) as D1Database;
 try{const result=await execute({...runtime,SANDBOX_DB:proxy},proxy);if(!recorded)await db.prepare('INSERT INTO sandbox_command_receipts VALUES(?,?,?)').bind(id,JSON.stringify(result),new Date().toISOString()).run();}catch(e){if(!recorded){if(!writeAttempted&&e instanceof SignupError&&e.status>=400&&e.status<500){await db.prepare('INSERT INTO sandbox_command_receipts VALUES(?,?,?)').bind(id,JSON.stringify({sandboxCommandFailure:{status:e.status,code:'rejected_before_write'}}),new Date().toISOString()).run();}throw e;}}
 return readSandboxCommand(runtime,a,scope,requestKey);
}
