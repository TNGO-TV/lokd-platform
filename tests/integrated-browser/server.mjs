import http from 'node:http';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import * as enquiries from '../../app/api/enquiries/route.ts';
if(process.env.LOKD_LOCAL_HANDLER_FIXTURE!=='enabled')throw Error('Explicit local fixture invocation required');
globalThis.fetch=async()=>{throw Error('Outbound providers are forbidden in local fixtures');};
const migrations=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('drizzle/'+f,'utf8'));
let sql;
function reset(){sql?.close();sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const migration of migrations)sql.exec(migration);}
reset();
function prepared(query,values=[]){return {bind(...values){return prepared(query,values);},async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}};}};}
env.DB={prepare:prepared,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
env.LOKD_APP_STAGE='production';
const port=Number(process.env.LOKD_HANDLER_PORT??4396);
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+req.headers.host);
  let response;
  if(url.pathname==='/__fixture/reset'&&req.method==='POST'){reset();response=Response.json({reset:true});}
  else if(url.pathname==='/__fixture/state')response=Response.json({enquiries:sql.prepare('SELECT * FROM client_enquiries').all(),receipts:sql.prepare('SELECT count(*) AS count FROM client_enquiry_receipts').get().count,audits:sql.prepare("SELECT count(*) AS count FROM audit_events WHERE entity_type='client_enquiry'").get().count});
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
