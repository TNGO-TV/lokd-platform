import {Miniflare} from 'miniflare';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {FINANCE_SANDBOX_POLICY} from '../app/lib/finance-sandbox-policy.ts';
import {resolveSandboxPolicy} from '../app/lib/sandbox-completion-policy.ts';
// Local-only binding. No Cloudflare API, credentials, remote configuration or DB
// alias is accepted. A distinct fixed local id is shared with the dev Vite config.
const directory=resolve('.wrangler/state/v3/d1'),policy=resolveSandboxPolicy(process.env.LOKD_SANDBOX_POLICY_JSON),hash=createHash('sha256').update(JSON.stringify(policy)).digest('hex');
const migrations=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
const sources=await Promise.all([...migrations.map(f=>'drizzle/'+f),...(await readdir('sandbox-migrations')).filter(f=>f.endsWith('.sql')).sort().map(f=>'sandbox-migrations/'+f)].map(async path=>[path,await readFile(path,'utf8')]));
const schemaHash=createHash('sha256').update(JSON.stringify(sources)).digest('hex');
await mkdir(directory,{recursive:true});
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("local fixture initializer")}}',compatibilityDate:'2026-05-22',d1Databases:{SANDBOX_DB:'00000000-0000-4000-8000-000000000002'},d1Persist:directory});
try{const db=await mf.getD1Database('SANDBOX_DB');await db.prepare('CREATE TABLE IF NOT EXISTS sandbox_local_bootstrap(singleton INTEGER PRIMARY KEY CHECK(singleton=1),schema_hash TEXT)').run();}finally{await mf.dispose();}
const root=directory+'/miniflare-D1DatabaseObject';let initialized=false;
for(const name of await readdir(root)){
 if(!name.endsWith('.sqlite')||name==='metadata.sqlite')continue;
 const db=new DatabaseSync(root+'/'+name);try{
  if(!db.prepare("SELECT name FROM sqlite_master WHERE name='sandbox_local_bootstrap'").get())continue;
  if(!db.prepare("PRAGMA table_info(sandbox_local_bootstrap)").all().some(c=>c.name==='schema_hash'))throw Error('Older local sandbox schema; preserve it and use a fresh isolated checkout.');
  if(initialized)throw Error('Ambiguous sandbox local binding');initialized=true;
  if(db.prepare("SELECT name FROM sqlite_master WHERE name='sandbox_completion_instance'").get()){
   const m=db.prepare('SELECT * FROM sandbox_completion_instance').get();if(m?.policy_hash!==hash||db.prepare('SELECT schema_hash FROM sandbox_local_bootstrap WHERE singleton=1').get()?.schema_hash!==schemaHash)throw Error('Existing sandbox policy or schema differs; use a fresh isolated checkout.');console.log('Existing local sandbox installation retained.');continue;
  }
  if(db.prepare("SELECT name FROM sqlite_master WHERE name='signup_cases'").get())throw Error('Refusing to mark an existing application database as sandbox.');
  db.exec('PRAGMA foreign_keys=ON; BEGIN');try{
   for(const [,sql] of sources)db.exec(sql);
   const financeJson=JSON.stringify(FINANCE_SANDBOX_POLICY);
   db.prepare("INSERT INTO finance_workflow_policies VALUES(?,'sandbox',?,?,?)").run(FINANCE_SANDBOX_POLICY.version,financeJson,createHash('sha256').update(financeJson).digest('hex'),new Date().toISOString());
   db.prepare('INSERT INTO sandbox_local_bootstrap VALUES(1,?)').run(schemaHash);
   db.prepare('INSERT INTO sandbox_completion_instance VALUES(1,?,?,?)').run('sandbox',policy.version,hash);db.prepare('INSERT INTO sandbox_retention_policy VALUES(1,?,?)').run(hash,policy.retentionDays);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  console.log('Initialized only the distinct local SANDBOX_DB with '+policy.version+'. Primary DB untouched.');
 }finally{db.close();}
}
if(!initialized)throw Error('Local sandbox binding file not found.');
