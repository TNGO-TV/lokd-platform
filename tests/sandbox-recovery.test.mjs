import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {ownerBackup,BACKUP_PATH} from '../worker/owner-backup.ts';
import {sandboxReady} from './fixtures/sandbox-completion.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
test('synthetic full-schema encrypted recovery uses a separated key, detects damage, and restores exact typed cells',async()=>{
 const x=await sandboxReady();mkdirSync('test-results',{recursive:true});const root=mkdtempSync(resolve('test-results/synthetic-recovery-'));
 try{
 const db={prepare(sql){assert.match(sql,/^(SELECT|PRAGMA|WITH)/);return {all:async()=>({success:true,results:x.db.sql.prepare(sql).all()})};},async batch(statements){x.db.sql.exec('BEGIN');try{const out=await Promise.all(statements.map(s=>s.all()));x.db.sql.exec('COMMIT');return out;}catch(e){x.db.sql.exec('ROLLBACK');throw e;}},withSession(){return db;}};
 const token=randomBytes(32).toString('hex'),env={DB:db,LOKD_BACKUP_ENABLED:'true',LOKD_BACKUP_EXPIRES_AT:String(Date.now()+60000),LOKD_BACKUP_TOKEN_SHA256:digest(token)};
 const response=await ownerBackup(new Request('https://synthetic.invalid'+BACKUP_PATH,{method:'POST',headers:{'x-owner-backup-token':token},body:JSON.stringify({action:'database'})}),env);
 assert.equal(response.status,200,response.status===200?'':await response.clone().text());const snapshot=await response.json();assert.equal(snapshot.format,'sqlite-typed-cells-v2');assert(snapshot.tables.some(t=>t.name==='sandbox_command_claims'));
 assert(snapshot.schema.some(s=>s.type==='view'&&s.name==='client_quote_offer_issues'));
 assert(snapshot.schema.some(s=>s.type==='trigger'&&/INSTEAD OF INSERT ON client_quote_offer_issues/i.test(s.sql)));
 for(const dir of ['capture','destination','separate-key-custodian','recoverer','gpg'])mkdirSync(join(root,dir),{mode:0o700});
 const source=join(root,'capture/database.json'),key=join(root,'separate-key-custodian/key'),archive=join(root,'capture/database.gpg'),copy=join(root,'destination/database.gpg'),restored=join(root,'recoverer/database.json');
 writeFileSync(source,JSON.stringify(snapshot),{mode:0o600});writeFileSync(key,randomBytes(48).toString('hex'),{mode:0o600});
 const base=['--homedir',join(root,'gpg'),'--batch','--no-symkey-cache','--pinentry-mode','loopback'];
 const run=args=>spawnSync('gpg',[...base,...args],{encoding:'utf8'});
 assert.equal(run(['--passphrase-file',key,'--symmetric','--cipher-algo','AES256','--output',archive,source]).status,0);
 copyFileSync(archive,copy);assert.equal(digest(readFileSync(copy)),digest(readFileSync(archive)));rmSync(join(root,'capture'),{recursive:true});
 const wrong=join(root,'separate-key-custodian/wrong');writeFileSync(wrong,randomBytes(48).toString('hex'),{mode:0o600});assert.notEqual(run(['--passphrase-file',wrong,'--decrypt',copy]).status,0);
 assert.equal(run(['--passphrase-file',key,'--output',restored,'--decrypt',copy]).status,0);assert.deepEqual(JSON.parse(readFileSync(restored,'utf8')),snapshot);
 const damaged=join(root,'destination/damaged.gpg'),bytes=readFileSync(copy);bytes[bytes.length-30]^=1;writeFileSync(damaged,bytes);assert.notEqual(run(['--passphrase-file',key,'--decrypt',damaged]).status,0);
 const check=spawnSync('python3',['-c',"import importlib.util,json,sys;from pathlib import Path;s=importlib.util.spec_from_file_location('capture','scripts/owner-backup-capture.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.restore(json.loads(Path(sys.argv[1]).read_text()),Path(sys.argv[2]))))",restored,join(root,'recoverer/restored.sqlite')],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);const report=JSON.parse(check.stdout);assert.equal(report.schema_match,true);assert.equal(report.cells_match,true);assert.equal(report.integrity,'ok');assert.equal(report.foreign_keys,'ok');
 console.log(JSON.stringify({mode:'synthetic-local-separated-directories',offHostAcceptance:false,tables:report.tables,rows:report.rows,encryptedCopyHash:digest(readFileSync(copy)),wrongKeyRejected:true,tamperRejected:true,exactRestore:true}));
 }finally{x.close();rmSync(root,{recursive:true,force:true});}
});
