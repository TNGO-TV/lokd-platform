import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function presenceFixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE signup_cases(kind TEXT,source_id TEXT,owner_user_id TEXT,version INTEGER,status TEXT);
 CREATE TABLE production_entity_links(kind TEXT,case_id TEXT,owner_user_id TEXT,case_version INTEGER,entity_id TEXT);
 CREATE TABLE public_officer_presence(id TEXT PRIMARY KEY,user_id TEXT,officer_id TEXT,mode TEXT,latitude REAL,longitude REAL,consented_at TEXT,updated_at TEXT,expires_at TEXT,UNIQUE(user_id,mode));
 CREATE TABLE assignment_activation_snapshots(id TEXT,officer_id TEXT,shift_id TEXT,roster_assignment_id TEXT,command_id TEXT,environment TEXT,integrity_state TEXT,final INTEGER,shift_starts_at TEXT,shift_ends_at TEXT,evidence_valid_through TEXT);
 CREATE TABLE shifts(id TEXT,environment TEXT,integrity_state TEXT,status TEXT,check_out_at TEXT);
 CREATE TABLE roster_assignments(id TEXT,status TEXT,active_key TEXT);
 CREATE TABLE assignment_activation_commands(id TEXT,state TEXT);
 CREATE TABLE assignment_revalidations(snapshot_id TEXT,status TEXT);
 INSERT INTO signup_cases VALUES('officer','case','user',1,'reviewed');
 INSERT INTO production_entity_links VALUES('officer','case','user',1,'OFF-CURRENT');
 INSERT INTO shifts VALUES('shift','production','production_verified','on_post',NULL);
 INSERT INTO roster_assignments VALUES('roster','confirmed','shift');
 INSERT INTO assignment_activation_commands VALUES('command','activated');`);
 sql.exec(fs.readFileSync(new URL('../../drizzle/0083_presence_revocation.sql',import.meta.url),'utf8'));
 sql.prepare('INSERT INTO officer_presence_consents VALUES(?,?,?,?,?,?)').run('user','live',1,'11111111-1111-4111-8111-111111111111',1,new Date().toISOString());
 const now=Date.now();sql.prepare('INSERT INTO assignment_activation_snapshots VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('snapshot','OFF-CURRENT','shift','roster','command','production','production_verified',1,new Date(now-60000).toISOString(),new Date(now+3600000).toISOString(),new Date(now+3600000).toISOString());
 const db={sql,prepare(query){return {first:async()=>sql.prepare(query).get()??null,bind(...values){return {async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){if(query.startsWith('INSERT INTO public_officer_presence'))await db.beforeWrite?.();const r=sql.prepare(query).run(...values);return {meta:{changes:Number(r.changes)}};}};}};}};
 db.batch=async statements=>{sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}};
 return {sql,db};
}
