import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
const compiled = await build({entryPoints:['worker/owner-backup.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {ownerBackup,BACKUP_PATH} = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const token='a'.repeat(64);
const config=()=>({LOKD_BACKUP_ENABLED:'true',LOKD_BACKUP_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),LOKD_BACKUP_EXPIRES_AT:String(Date.now()+600000)});
const req=(input,headers={})=>new Request('https://backup.invalid'+BACKUP_PATH,{method:'POST',headers:{'x-owner-backup-token':token,...headers},body:JSON.stringify(input)});
function adapter(sqlite) {
 const db={prepare(sql){assert.match(sql,/^(SELECT|PRAGMA|WITH)/);return {sql,async all(){return {success:true,results:sqlite.prepare(sql).all()}}}},async batch(statements){sqlite.exec('BEGIN');try{const results=await Promise.all(statements.map(s=>s.all()));sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}},withSession(){return db}};return db;
}
const q=s=>'"'+s.replaceAll('"','""')+'"';
function restore(snapshot){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=OFF');
 for(const s of snapshot.schema.filter(s=>s.type==='table'&&s.sql&&s.name!=='sqlite_sequence'))db.exec(s.sql);
 for(const t of snapshot.tables){
  const cols=[...(t.rowid?[{name:t.rowid,hidden:0}]:[]),...t.columns];
  const indices=cols.flatMap((c,i)=>c.hidden?[]:[i]);
  if(t.name==='sqlite_sequence')db.exec('DELETE FROM sqlite_sequence');
  const stmt=db.prepare(`INSERT INTO ${q(t.name)} (${indices.map(i=>q(cols[i].name)).join(',')}) VALUES (${indices.map(()=>'?').join(',')})`);
  for(const row of t.rows)stmt.run(...indices.map(i=>{const [kind,value]=row[i];return kind==='integer'?BigInt(value):kind==='real'?Number(value):kind==='blob'?Buffer.from(value,'hex'):value}));
 }
 for(const s of snapshot.schema.filter(s=>s.type!=='table'&&s.sql))db.exec(s.sql);
 return db;
}
test('authorization fails closed without touching bindings',async()=>{
 const bindings={get DB(){throw Error('DB access')},get BUCKET(){throw Error('Bucket access')}};
 for(const cfg of [{},{...config(),LOKD_BACKUP_ENABLED:'false'},{...config(),LOKD_BACKUP_EXPIRES_AT:'0'},{...config(),LOKD_BACKUP_EXPIRES_AT:String(Date.now()+7200000)}])assert.equal((await ownerBackup(req({action:'database'}),Object.defineProperties({...cfg},Object.getOwnPropertyDescriptors(bindings)))).status,404);
 const env=config();Object.defineProperties(env,Object.getOwnPropertyDescriptors(bindings));
 for(const r of [req({action:'runtime'},{origin:'https://backup.invalid'}),req({action:'runtime'},{'x-owner-backup-token':'b'.repeat(64)}),new Request('https://backup.invalid'+BACKUP_PATH)])assert.equal((await ownerBackup(r,env)).status,404);
 assert.equal(await ownerBackup(new Request('https://backup.invalid/ordinary'),env),null);
 assert.equal((await ownerBackup(req({action:'x'.repeat(9000)}),env)).status,413);
});
test('real SQLite snapshot and restored schema/cells match exactly',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE data(id INTEGER PRIMARY KEY AUTOINCREMENT, big INTEGER, r REAL, b BLOB, txt TEXT, generated TEXT GENERATED ALWAYS AS (txt || '!') STORED);
 INSERT INTO data(id,big,r,b,txt) VALUES(27,9223372036854775807,1.2345678901234567,X'00FF80', 'quotes"雪');
 INSERT INTO data(id,big,r,b,txt) VALUES(45,-9223372036854775808,1e-300,X'', NULL);
 INSERT INTO data(id) VALUES(100); DELETE FROM data WHERE id=100;
 CREATE TABLE hidden(t TEXT); INSERT INTO hidden(rowid,t) VALUES(555,'x');
 CREATE TABLE keyed(k TEXT PRIMARY KEY,v REAL) WITHOUT ROWID; INSERT INTO keyed VALUES('x',1.7976931348623157e308);
 CREATE INDEX idx ON data(txt); CREATE VIEW data_view AS SELECT big FROM data;
 CREATE TRIGGER tr AFTER INSERT ON hidden BEGIN UPDATE hidden SET t='triggered' WHERE rowid=new.rowid; END;`);
 const snap=await (await ownerBackup(req({action:'database'}),{...config(),DB:adapter(db)})).json();
 assert.equal(snap.format,'sqlite-typed-cells-v2');
 const restored=restore(snap);
 const next=await (await ownerBackup(req({action:'database'}),{...config(),DB:adapter(restored)})).json();
 delete snap.captured_at;delete next.captured_at;assert.deepEqual(next,snap);
 assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[]);
 db.close();restored.close();
});
test('unsupported schemas and oversized snapshots fail without partial success',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE huge(v TEXT); INSERT INTO huge VALUES(hex(zeroblob(2200000)))');
 assert.equal((await ownerBackup(req({action:'database'}),{...config(),DB:adapter(db)})).status,422);
 db.close();
});
test('object version changes are rejected and runtime is private',async()=>{
 const env={...config(),CLERK_SECRET_KEY:'fixture',PLATFORM_INTERNAL:'must-not-export',BUCKET:{get:async()=>({body:new ReadableStream(),version:'new'})}};
 assert.equal((await ownerBackup(req({action:'object',key:'x',etag:'x',version:'old'}),env)).status,412);
 const response=await ownerBackup(req({action:'runtime'}),env);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal((await response.json()).values.CLERK_SECRET_KEY,'fixture');
});
