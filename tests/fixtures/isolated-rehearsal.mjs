import fs from 'node:fs';
import {afterEach} from 'node:test';
const cleanups=[];
afterEach(()=>{while(cleanups.length)cleanups.pop()();});
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';

// Explicit installation for legacy rehearsal route tests. The primary binding
// is a different in-memory database; test routes must never mutate it.
export function installRehearsal(testDb, {bucket, stage='demo'}={}) {
  const sqlite=testDb.sql??testDb.database??testDb.db;
  if (!sqlite) throw Error('Rehearsal fixture requires a real isolated SQLite adapter');
  sqlite.exec(fs.readFileSync(new URL('../../scripts/isolated-rehearsal-marker.sql',import.meta.url),'utf8'));
  const primary=new DatabaseSync(':memory:');
  const db={prepare(sql){return {first:async()=>primary.prepare(sql).get()??null};}};
  const prior={...env};
  Object.assign(env,{DB:db,TEST_DB:testDb,TEST_BUCKET:bucket,LOKD_APP_STAGE:stage,LOKD_TEST_SURFACES_ENABLED:'true'});
  let closed=false;const close=()=>{if(closed)return;closed=true;primary.close();for(const key of Object.keys(env))delete env[key];Object.assign(env,prior);};
  cleanups.push(close);return {primary,close};
}
