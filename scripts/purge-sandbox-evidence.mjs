// Local SQLite maintenance only. Example:
// node --experimental-strip-types --import ./tests/register-cloudflare.mjs scripts/purge-sandbox-evidence.mjs --primary /path/primary.sqlite --sandbox /path/sandbox.sqlite --actor local-owner --limit 50
import {DatabaseSync} from 'node:sqlite';
import {realpathSync,statSync} from 'node:fs';
import {purgeSandboxEvidence} from '../app/lib/sandbox-retention.ts';
const values={};for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!['--primary','--sandbox','--actor','--limit'].includes(key)||!value||key in values)throw Error('Use --primary FILE --sandbox FILE --actor OWNER [--limit 1..100]');values[key]=value;}
if(!values['--primary']||!values['--sandbox']||!values['--actor'])throw Error('Explicit local primary/sandbox files and maintenance owner required.');
const primaryPath=realpathSync(values['--primary']),sandboxPath=realpathSync(values['--sandbox']);if(primaryPath===sandboxPath||!statSync(primaryPath).isFile()||!statSync(sandboxPath).isFile())throw Error('Distinct existing local database files required.');
class Statement{constructor(db,sql,args=[]){Object.assign(this,{db,sql,args});}bind(...args){return new Statement(this.db,this.sql,args);}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}sync(){return {meta:{changes:Number(this.db.prepare(this.sql).run(...this.args).changes)}};}async run(){return this.sync();}}
class Adapter{constructor(db){this.db=db;}prepare(sql){return new Statement(this.db,sql);}async batch(statements){this.db.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.sync());this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}}
const primary=new DatabaseSync(primaryPath,{readOnly:true}),sandbox=new DatabaseSync(sandboxPath);
try{sandbox.exec('PRAGMA foreign_keys=ON');const result=await purgeSandboxEvidence({DB:new Adapter(primary),SANDBOX_DB:new Adapter(sandbox),LOKD_APP_STAGE:'prelaunch',LOKD_SANDBOX_COMPLETION_ENABLED:'true',LOKD_SANDBOX_POLICY_JSON:process.env.LOKD_SANDBOX_POLICY_JSON},{userId:values['--actor'],email:'local-maintenance@example.test',operations:true,owner:true},Number(values['--limit']??50));console.log(JSON.stringify(result));}finally{primary.close();sandbox.close();}
