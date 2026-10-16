import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
import {generateSQLiteDrizzleJson,generateSQLiteMigration} from 'drizzle-kit/api';
const require=createRequire(import.meta.url);
const consumer=createRequire(require.resolve('satori'));
const fflate=consumer('fflate');

test('fixed compression dependency preserves font-data inflation and rejects malformed ZIP64 within a bounded process',()=>{
 const original=fflate.strToU8('Synthetic LOKD font payload '.repeat(100));
 assert.deepEqual(fflate.inflateSync(fflate.deflateSync(original)),original);
 const zip=Buffer.from(fflate.zipSync({'fixture.txt':original}));
 const central=zip.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));assert.ok(central>=0);
 zip.writeUInt32LE(0xffffffff,central+20);zip.writeUInt16LE(0,central+30);
 const end=zip.length-22,zip64=Buffer.alloc(56),locator=Buffer.alloc(20),eocd=Buffer.from(zip.subarray(end));
 zip64.writeUInt32LE(0x06064b50,0);zip64.writeUInt32LE(44,4);zip64.writeUInt32LE(1,32);zip64.writeUInt32LE(central,48);
 locator.writeUInt32LE(0x07064b50,0);locator.writeUInt32LE(end,8);locator.writeUInt32LE(1,16);
 eocd.writeUInt16LE(65535,8);eocd.writeUInt32LE(0xffffffff,16);
 const malformed=Buffer.concat([zip.subarray(0,end),zip64,locator,eocd]);
 const code='const f=require('+JSON.stringify(consumer.resolve('fflate'))+');try{f.unzipSync(Buffer.from('+JSON.stringify(malformed.toString('base64'))+',"base64"));process.exitCode=2;}catch{process.stdout.write("rejected");}';
 const child=spawnSync(process.execPath,['-e',code],{encoding:'utf8',timeout:5000});
 assert.equal(child.error,undefined);assert.equal(child.status,0);assert.equal(child.stdout,'rejected');
});

test('Satori renders a local font through the patched installed dependency graph',async()=>{
 const {default:satori}=await import('satori');
 const entry=require.resolve('@vercel/og');const font=fs.readFileSync(path.join(path.dirname(entry),'Geist-Regular.ttf'));
 const svg=await satori({type:'div',props:{style:{display:'flex',fontFamily:'Geist',fontSize:24},children:'LOKD fixture'}},{width:320,height:100,fonts:[{name:'Geist',data:font,weight:400,style:'normal'}]});
 assert.match(svg,/<svg/);assert.match(svg,/<path/);
});

test('unchanged Drizzle API generates and round-trips disposable SQLite schema migrations',async()=>{
 const accounts=sqliteTable('fixture_accounts',{id:text('id').primaryKey(),name:text('name').notNull()});
 const events=sqliteTable('fixture_events',{id:integer('id').primaryKey(),accountId:text('account_id').references(()=>accounts.id),note:text('note')});
 const before=await generateSQLiteDrizzleJson({}),after=await generateSQLiteDrizzleJson({accounts,events},before.id);
 const migration=await generateSQLiteMigration(before,after);
 assert.equal(migration.length,2);assert.match(migration.join('\n'),/CREATE TABLE .*fixture_accounts/);assert.match(migration.join('\n'),/FOREIGN KEY/);
 assert.deepEqual(await generateSQLiteMigration(after,after),[]);
});
