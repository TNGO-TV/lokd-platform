import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {env} from 'cloudflare:workers';
import {GET,POST} from '../app/api/passport/route.ts';
import {POST as verify} from '../app/api/passport/verify/route.ts';
import {passportQr} from '../app/lib/passport-qr.ts';

const token='lokd_live_'+'a'.repeat(64);
const request=(body)=>new Request('https://lokd.co.za/api/passport',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
function database(passport){return {prepare(sql){return {bind(){return this;},async first(){return sql.includes('FROM officer_passports p JOIN officers')?passport:null;},async all(){return {results:[]};}};}};}
const row={officerId:'OFF-1',passportNumber:'LOKD-P-1',status:'revoked',readinessLabel:'Review required',lastReviewedAt:'2026-01-01T00:00:00Z',nextReviewAt:'2099-01-01T00:00:00Z',environment:'production',integrityState:'verified',evidenceReference:'readiness-passport:1',officerName:'Officer Name',psiraGrade:'Grade C',psiraExpiry:'2099-01-01'};

test('public passport APIs reject legacy tokens before reading storage',async()=>{
 env.DB={prepare(){throw Error('Legacy token must not reach storage');}};
 assert.equal((await GET(new Request('https://lokd.co.za/api/passport?token=lokdvp_'+'a'.repeat(32)))).status,400);
 assert.equal((await POST(request({token:'lokdvp_'+'a'.repeat(32)}))).status,400);
 delete env.DB;
});
test('both public verification APIs hide nonproduction records',async()=>{
 env.DB=database({...row,environment:'demo',integrityState:'synthetic',evidenceReference:null});
 assert.equal((await POST(request({token}))).status,404);
 assert.equal((await verify(request({token}))).status,404);
 delete env.DB;
});
test('revocation is shown as red on every read and cannot record arrival',async()=>{
 env.DB=database(row);
 for(const handler of [POST,verify]){
  const response=await handler(request({token}));assert.equal(response.status,200);
  const {passport}=await response.json();assert.equal(passport.result,'red');assert.equal(passport.status,'revoked');assert.equal(passport.productionAuthorized,false);
 }
 assert.equal((await POST(request({token,bookingId:'BOOK-1'}))).status,400);
 delete env.DB;
});
test('private passport QR stays deterministic at the supported production URL length',()=>{
 const matrix=passportQr('https://lokd.co.za/verify#token='+token);
 assert.equal(matrix.length,37);assert.ok(matrix.every(row=>row.length===37));
 // This vector was independently decoded with ZXing to the exact private URL.
 assert.equal(createHash('sha256').update(JSON.stringify(matrix)).digest('hex'),'53d2089d14aa928e3246a3092dd04da3e843ffb24690b67c9ee9000cc08b760d');
 assert.throws(()=>passportQr('x'.repeat(107)),/too long/);
});
