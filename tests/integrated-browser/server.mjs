import http from 'node:http';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import * as clientBookings from '../../app/api/client-bookings/route.ts';
import * as training from '../../app/api/zone-training/route.ts';
import * as operations from '../../app/api/zone-operations/route.ts';
import * as onboarding from '../../app/api/onboarding/route.ts';
import * as location from '../../app/api/zone-location/route.ts';
import { complete, applicant } from '../fixtures/production-identity-journey.mjs';
import { seedClient, seedBooking, seedRoster, client } from '../fixtures/client-booking-db.mjs';
import { operateZoneTraining } from '../../app/lib/zone-training.ts';
import * as enquiries from '../../app/api/enquiries/route.ts';
if(process.env.LOKD_LOCAL_HANDLER_FIXTURE!=='enabled')throw Error('Explicit local fixture invocation required');
globalThis.fetch=async()=>{throw Error('Outbound providers are forbidden in local fixtures');};
const migrations=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('drizzle/'+f,'utf8'));
let sql;
function reset(){sql?.close();sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const migration of migrations)sql.exec(migration);}
reset();
function prepared(query,values=[]){return {bind(...values){return prepared(query,values);},async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}};}};}
const adapter={prepare:prepared,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
env.DB=adapter;
env.LOKD_APP_STAGE='production';
const personas={client,officer:applicant,maker:{userId:'training-maker',email:'maker@example.test',operations:true,owner:true},checker:{userId:'training-checker',email:'checker@example.test',operations:true,owner:true}};
let persona=null;
env.LOKD_OWNER_ACCESS_JSON=JSON.stringify([personas.maker.email,personas.checker.email]);
async function zoneReset(kind){
 reset();persona=personas[kind]??personas.client;
 if(kind==='officer'){sql.close();const x=await complete();sql=x.db.sql;env.DB=adapter;}
 if(kind==='client'||kind==='maker'||kind==='checker'){
  seedClient({sql});seedBooking({sql});seedRoster({sql},{assigned:false});
  sql.exec("UPDATE bookings SET engagement_model='fixed',contract_months=3,roster_pattern='weekdays',site_name='West Street Offices',site_area='Sandton';UPDATE operational_sites SET name='West Street Offices',area='Sandton',address_label='135 West Street, Sandton',latitude_e6=-26107600,longitude_e6=28056700");
 }
 const now=new Date().toISOString();
 for(const p of [personas.maker,personas.checker]){sql.prepare("INSERT INTO operator_accounts(id,email,display_name,status,approval_limit_cents,environment,integrity_state,created_at,updated_at) VALUES(?,?,?,'active',100000000,'production','production_verified',?,?)").run(p.userId,p.email,p.userId,now,now);for(const role of ['operations_owner','operations_controller'])sql.prepare("INSERT INTO operator_role_assignments(id,operator_id,role,status,environment,integrity_state,granted_by,granted_at) VALUES(?,?,?,'active','production','production_verified','fixture',?)").run(p.userId+role,p.userId,role,now);}
 const session=await operateZoneTraining(adapter,personas.maker,{action:'create_session',requestId:crypto.randomUUID(),courseId:'firearms-competency',startsAt:'2090-12-01T06:00:00Z',endsAt:'2090-12-01T14:00:00Z',venue:'Johannesburg training centre',capacity:12});
 await operateZoneTraining(adapter,personas.maker,{action:'publish_session',id:session.id,expectedVersion:1,feeCents:45000,feeTerms:'Reviewed paid course agreement for this isolated browser fixture',feeApproved:true});
}
const zoneHandlers={'/api/client-bookings':clientBookings,'/api/zone-training':training,'/api/zone-operations':operations,'/api/onboarding':onboarding,'/api/zone-location':location};
const port=Number(process.env.LOKD_HANDLER_PORT??4396);
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+req.headers.host);
  let response;
  if(url.pathname==='/__fixture/reset'&&req.method==='POST'){reset();env.DB=adapter;persona=null;response=Response.json({reset:true});}
  else if(url.pathname==='/__fixture/zone-reset'&&req.method==='POST'){await zoneReset(url.searchParams.get('persona'));response=Response.json({reset:true});}
  else if(url.pathname==='/__fixture/zone-persona'&&req.method==='POST'){persona=personas[url.searchParams.get('persona')]??null;response=Response.json({changed:true});}
  else if(url.pathname==='/__fixture/zone-state')response=Response.json({requests:sql.prepare('SELECT * FROM service_requests').all(),enrolments:sql.prepare('SELECT * FROM zone_training_enrolments').all(),renewals:sql.prepare('SELECT * FROM zone_training_renewal_requests').all()});
  else if(zoneHandlers[url.pathname]){const headers=new Headers(req.headers);for(const key of [...headers.keys()])if(key.startsWith('x-lokd-verified-'))headers.delete(key);if(persona){headers.set('x-lokd-verified-user-id',persona.userId);headers.set('x-lokd-verified-email',persona.email);if(persona.operations){headers.set('x-lokd-verified-mfa-enrolled','true');headers.set('x-lokd-verified-second-factor-at',new Date().toISOString());}}const body=['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(await Array.fromAsync(req));const request=new Request(url,{method:req.method,headers,body});response=await zoneHandlers[url.pathname][req.method](request);}
  else if(url.pathname==='/__fixture/state')response=Response.json({enquiries:sql.prepare('SELECT * FROM client_enquiries').all(),receipts:sql.prepare('SELECT count(*) AS count FROM client_enquiry_receipts').get().count,audits:sql.prepare("SELECT count(*) AS count FROM audit_events WHERE entity_type='client_enquiry'").get().count,submissionAudits:sql.prepare("SELECT count(*) AS count FROM audit_events WHERE event_type='public_client_enquiry_submitted'").get().count});
  else if(url.pathname==='/api/enquiries'){
   const headers=new Headers(req.headers);for(const key of [...headers.keys()])if(key.startsWith('x-lokd-verified-'))headers.delete(key);
   const body=['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(await Array.fromAsync(req));
   const request=new Request(url,{method:req.method,headers,body});
   const handler=enquiries[req.method];response=handler?await handler(request):new Response('Method not allowed',{status:405});
  }else response=new Response('Not found',{status:404});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error);res.writeHead(500);res.end('Local handler failure');}
});
server.listen(port,'127.0.0.1',()=>console.log('Production enquiry handlers on local fixtures: '+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{sql.close();process.exit(0);}));
