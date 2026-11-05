// In-process SMTP peer for tests. It replaces the cloudflare:sockets connector
// (see tests/cloudflare-loader.mjs) and records every message it is sent.
const ACCEPT='220 ready\r\n250-mail.example.test\r\n250 AUTH LOGIN\r\n334 user\r\n334 pass\r\n235 authenticated\r\n250 sender\r\n250 recipient\r\n354 data\r\n250 accepted\r\n';
// Closes after DATA is written, before the server confirms acceptance.
const LOST=ACCEPT.slice(0,ACCEPT.indexOf('250 accepted'));

export const smtpRuntime={LOKD_SMTP_HOST:'mail.example.test',LOKD_SMTP_PORT:'465',LOKD_SMTP_USER:'notices@example.test',LOKD_SMTP_PASSWORD:'local-fixture'};

export function installSmtpServer({mode=()=> 'accept'}={}){
 const sessions=[];
 globalThis.__lokdTestSmtpConnect=(address,options)=>{
  const session={address,options,writes:[]};sessions.push(session);
  const response=mode(sessions.length)==='lost'?LOST:ACCEPT;
  return {opened:Promise.resolve(),
   readable:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(response));c.close();}}),
   writable:new WritableStream({write(bytes){session.writes.push(new TextDecoder().decode(bytes));}}),
   close(){return Promise.resolve();},startTls(){throw Error('unexpected STARTTLS');}};
 };
 const messages=()=>sessions.filter(s=>s.writes.some(w=>w.startsWith('From:'))).map(s=>{
  const data=s.writes.find(w=>w.startsWith('From:'));
  const header=name=>(new RegExp('^'+name+': (.*)$','m').exec(data)??[])[1]?.replace(/\r$/,'');
  return {from:header('From'),to:header('To'),subject:header('Subject'),data,rcpt:s.writes.find(w=>w.startsWith('RCPT TO:'))};
 });
 return {sessions,messages,uninstall(){delete globalThis.__lokdTestSmtpConnect;}};
}
