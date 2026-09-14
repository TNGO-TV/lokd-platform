import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import JoinPage from '../../app/join/page';
import ClientEnquiryForm from '../../app/components/client-enquiry-form';
import '../../app/globals.css';
import SandboxCompletionWorkspace from '../../app/components/sandbox-completion-workspace';
import WorkspaceShell from '../../app/components/workspace-shell';
function LocalRoles(){const [busy,setBusy]=useState(false),[error,setError]=useState('');async function choose(role:string,path:string){setBusy(true);try{const response=await fetch('/__fixture/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role})});if(!response.ok)throw Error('The local fixture session could not be opened.');location.assign(path);}catch(cause){setError(String(cause));setBusy(false);}}return <aside style={{padding:'1rem',borderBottom:'2px solid #9b6600',background:'#fff2d8',color:'#392900'}}><strong>LOCAL REHEARSAL · fictional accounts · no external providers</strong><p>This test toolbar creates opaque local fixture sessions. It does not prove Clerk sign-in or production access.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[['client','Client','/client/sandbox'],['officer','Officer','/officer/sandbox'],['maker','Operations proposer','/ops/sandbox?owner=false'],['checker','Separate reviewer','/ops/sandbox']].map(([role,label,path])=><button key={role} disabled={busy} onClick={()=>void choose(role,path)} style={{border:'1px solid #9b6600',borderRadius:6,padding:10}}>Use synthetic {label}</button>)}</div>{error&&<p role="alert">{error}</p>}</aside>;}

if(location.pathname==='/join')createRoot(document.getElementById('root')!).render(<JoinPage/>);
else if(location.pathname==='/contact')createRoot(document.getElementById('root')!).render(<ClientEnquiryForm/>);
else if(location.pathname.endsWith('/sandbox')){const q=new URLSearchParams(location.search),ops=location.pathname.startsWith('/ops');createRoot(document.getElementById('root')!).render(<WorkspaceShell role={ops?'operations':location.pathname.startsWith('/client')?'client':'officer'}><LocalRoles/><SandboxCompletionWorkspace kind={location.pathname.startsWith('/client')?'client':'officer'} operations={ops} owner={ops&&q.get('owner')!=='false'} applicantId={q.get('applicantId')??''} applicantVersion={Number(q.get('applicantVersion'))||1}/></WorkspaceShell>);}
else void import('../frontend/main');
