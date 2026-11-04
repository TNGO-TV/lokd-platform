import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
class Statement {
 constructor(db,sql,args=[]){Object.assign(this,{db,sql,args});}
 bind(...args){return new Statement(this.db,this.sql,args);}
 async first(){return this.db.prepare(this.sql).get(...this.args)??null;}
 async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
 runSync(){return {meta:{changes:Number(this.db.prepare(this.sql).run(...this.args).changes)}};}
 async run(){return this.runSync();}
}
export function operationsDatabase(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const name of readdirSync(new URL('../../drizzle',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../../drizzle/'+name,import.meta.url),'utf8'));
 const db={prepare:sql=>new Statement(sqlite,sql),batch:async statements=>{sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.runSync());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,db};
}
export function addOperator(sqlite,id,roles,limit=1000000,email=id+'@example.test'){
 const now=new Date().toISOString();
 sqlite.prepare("INSERT INTO operator_accounts(id,email,display_name,status,approval_limit_cents,environment,integrity_state,created_at,updated_at) VALUES(?,?,?,'active',?,'production','production_verified',?,?)").run(id,email,id,limit,now,now);
 for(const role of roles)sqlite.prepare("INSERT INTO operator_role_assignments(id,operator_id,role,status,environment,integrity_state,granted_by,granted_at) VALUES(?,?,?,'active','production','production_verified','fixture-admin',?)").run(id+role,id,role,now);
 return new Headers({'x-lokd-verified-user-id':id,'x-lokd-verified-email':email,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date(Date.now()-60000).toISOString()});
}
