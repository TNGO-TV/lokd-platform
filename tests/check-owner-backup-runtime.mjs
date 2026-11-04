import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=process.cwd();
const require=createRequire(root+'/package.json');
const {Miniflare}=require('miniflare');const {build}=require('esbuild');
const out=await build({stdin:{contents:`import {ownerBackup} from './worker/owner-backup';export default {fetch:ownerBackup}`,resolveDir:root},bundle:true,format:'esm',write:false});
const token='a'.repeat(64);
const mf=new Miniflare({modules:true,script:out.outputFiles[0].text.replace('} catch {', '} catch (error) { console.error(String(error));'),compatibilityDate:'2026-05-22',d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{LOKD_BACKUP_ENABLED:'true',LOKD_BACKUP_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),LOKD_BACKUP_EXPIRES_AT:String(Date.now()+600000)}});
try{
 const db=await mf.getD1Database('DB');await db.exec('CREATE TABLE records(id INTEGER PRIMARY KEY, b BLOB); INSERT INTO records VALUES(17,X\'00FF\')');
 for(let i=0;i<30;i++){await db.exec('CREATE TABLE wide_'+i+'('+Array.from({length:45},(_,j)=>'col_'+j+' TEXT').join(',')+')');await db.exec(`INSERT INTO wide_${i}(col_0,col_44) VALUES('first','last')`);}
 const metadata=await db.prepare(`SELECT m.name AS table_name,p.name,p.type,p.pk,p.hidden FROM sqlite_schema m JOIN pragma_table_xinfo(m.name) p WHERE m.type='table' AND substr(lower(m.name),1,4)!='_cf_'`).all();assert.ok(metadata.results.length);console.log('Bulk D1 column metadata PASS');
 const call=input=>mf.dispatchFetch('https://backup.invalid/api/internal/owner-backup',{method:'POST',headers:{'x-owner-backup-token':token},body:JSON.stringify(input)});
 const response=await call({action:'database'});if(response.status!==200)console.log(await response.clone().text());assert.equal(response.status,200);const data=await response.json();assert.equal(data.format,'sqlite-typed-cells-v2');assert.ok(data.tables.some(t=>t.name==='records'));
 writeFileSync('/tmp/lokd-backup-synthetic-snapshot.json',JSON.stringify(data));
 execFileSync('python3',['-c',`import importlib.util,tempfile,json;from pathlib import Path;s=importlib.util.spec_from_file_location('capture','${root}/scripts/owner-backup-capture.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);d=Path(tempfile.mkdtemp(prefix='lokd-backup-synthetic-'));print(m.restore(json.loads(Path('/tmp/lokd-backup-synthetic-snapshot.json').read_text()),d/'restored.sqlite'))`],{stdio:'inherit'});
 const bucket=await mf.getR2Bucket('BUCKET');await bucket.put('folder/test',new Uint8Array([0,255,80]),{httpMetadata:{contentType:'test/example'},customMetadata:{purpose:'fixture'}});
 const inventory=await (await call({action:'objects'})).json();const obj=inventory.objects[0];assert.equal(obj.httpMetadata.contentType,'test/example');assert.equal(obj.customMetadata.purpose,'fixture');
 const bytes=await call({action:'object',key:obj.key,etag:obj.etag,version:obj.version});assert.equal(bytes.status,200);assert.deepEqual([...new Uint8Array(await bytes.arrayBuffer())],[0,255,80]);
 console.log('Miniflare D1 session snapshot and R2 metadata/version/download PASS');
}finally{await mf.dispose()}
