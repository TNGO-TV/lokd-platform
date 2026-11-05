import assert from 'node:assert/strict';
import test from 'node:test';
import {sendSmtpOverSocket,SMTP_LIMITS} from '../app/lib/operational-provider.ts';

const runtime={LOKD_SMTP_HOST:'fixture.invalid',LOKD_SMTP_USER:'fixture',LOKD_SMTP_PASSWORD:'fixture'};
const body={from:'sender@example.test',to:['recipient@example.test'],subject:'Fixture',text:'.dot\nPrivate synthetic text'};
const replies='220 ready\r\n250-fixture\r\n250 AUTH LOGIN\r\n334 user\r\n334 pass\r\n235 authenticated\r\n250 sender\r\n250 recipient\r\n354 data\r\n250 accepted 雪\r\n';
const short={...SMTP_LIMITS,connectMs:40,readMs:40,writeMs:40,totalMs:180};
const never=()=>new Promise(()=>{});
function fixture({response=replies,opened=Promise.resolve(),stallWrite,close=()=>Promise.resolve()}={}){
 const writes=[];let closed=0;
 const socket={opened,readable:new ReadableStream({start(c){if(response!==null)c.enqueue(new TextEncoder().encode(response));}}),
  writable:new WritableStream({write(bytes){const line=new TextDecoder().decode(bytes);writes.push(line);if(stallWrite?.(line))return never();}}),
  close(){closed++;return close();},startTls(){throw Error('unexpected STARTTLS');}};
 return {socket,writes,connect:()=>socket,closed:()=>closed};
}
const uncertain=code=>e=>e.disposition==='uncertain'&&e.code===code;

test('SMTP preserves UTF-8 reply boundaries, dot stuffing and confirmed acceptance despite stalled QUIT/cleanup',async()=>{
 const x=fixture({response:replies.replace('220 ready','220 ready 雪'),stallWrite:line=>line==='QUIT\r\n',close:never});
 const result=await sendSmtpOverSocket(runtime,'delivery-1',body,x.connect,short);
 assert.match(result,/^smtp:delivery-1:250 accepted 雪$/);
 assert(x.writes.some(line=>line.includes('\r\n..dot\r\n')));assert.equal(x.closed(),1);
});

test('SMTP bounds connect, read and write waits and closes each uncertain transaction',async()=>{
 for(const [options,code] of [[{opened:never()},'smtp_connect_timeout'],[{response:null},'smtp_read_timeout'],[{stallWrite:()=>true},'smtp_write_timeout']]){
  const x=fixture(options);
  await assert.rejects(sendSmtpOverSocket(runtime,'delivery-2',body,x.connect,short),uncertain(code));
  assert.equal(x.closed(),1);
 }
});

test('total SMTP deadline bounds a trickling peer even while each read finishes',async()=>{
 const x=fixture({response:null});let cancelled=false;
 x.socket.readable=new ReadableStream({async pull(c){await new Promise(r=>setTimeout(r,10));if(!cancelled)c.enqueue(new Uint8Array([50]));},cancel(){cancelled=true;}});
 await assert.rejects(sendSmtpOverSocket(runtime,'delivery-3',body,x.connect,{...short,totalMs:65}),uncertain('smtp_total_timeout'));
 assert.equal(x.closed(),1);
});

test('SMTP rejects oversized lines, multiline floods and inconsistent reply codes',async()=>{
 for(const [response,code] of [['2'.repeat(SMTP_LIMITS.lineBytes),'smtp_line_too_large'],['220-more\r\n'.repeat(SMTP_LIMITS.responseLines+1),'smtp_response_too_many_lines'],['220-first\r\n250 wrong\r\n','smtp_protocol_invalid'],['not smtp\r\n','smtp_protocol_invalid']]){
  const x=fixture({response});await assert.rejects(sendSmtpOverSocket(runtime,'delivery-4',body,x.connect,short),uncertain(code));assert.equal(x.closed(),1);
 }
});

test('SMTP enforces response and aggregate byte budgets',async()=>{
 for(const [limits,code] of [[{...short,responseBytes:15},'smtp_response_too_large'],[{...short,totalBytes:10},'smtp_protocol_too_large']]){
  const x=fixture();await assert.rejects(sendSmtpOverSocket(runtime,'delivery-5',body,x.connect,limits),uncertain(code));assert.equal(x.closed(),1);
 }
});

test('SMTP counts encoded message bytes before connecting and rejects injected ids',async()=>{
 let connections=0;const connect=()=>{connections++;throw Error('unexpected connection');};
 for(const [id,payload] of [['delivery-6',{...body,text:'雪'.repeat(400000)}],['bad\r\nHeader: value',body]]){
  await assert.rejects(sendSmtpOverSocket(runtime,id,payload,connect),e=>e.code==='smtp_message_too_large'&&e.disposition==='blocked');
 }
 assert.equal(connections,0);
});

test('STARTTLS handshake shares the original total deadline',async()=>{
 const x=fixture({response:'220 ready\r\n250 ready\r\n220 upgrade\r\n'}),tls=fixture({opened:never()});
 x.socket.startTls=()=>tls.socket;
 await assert.rejects(sendSmtpOverSocket({...runtime,LOKD_SMTP_PORT:'587'},'delivery-7',body,x.connect,short),uncertain('smtp_connect_timeout'));
 assert.equal(tls.closed(),1);
});

test('missing DATA acceptance remains uncertain rather than authorizing a retry',async()=>{
 const x=fixture({response:replies.slice(0,replies.indexOf('250 accepted'))});
 await assert.rejects(sendSmtpOverSocket(runtime,'delivery-8',body,x.connect,short),uncertain('smtp_read_timeout'));
 assert(x.writes.some(line=>line.startsWith('From:')));assert.equal(x.closed(),1);
});
