'use client';
import {useState} from 'react';
import styles from './signup-portal.module.css';
export type RecoveryPayment={reference:string;mode:string;status:string;version:number;source_hash:string;destination_id:string;current:boolean;payroll_item_id?:string;payable_id?:string;recovery?:{
 terminal:{evidence_id:string;disposition:'failed'|'reversed'}|null;
 proposals:{id:string;instruction_version:number;evidence_id:string;disposition:string;note:string;operator_id:string;approval_id:string|null;approved_by:string|null}[];
 replacements:{reference:string;predecessor:string;approval_id:string|null}[];held:boolean;
}};
export default function PaymentRecoveryControls({payment:i,kind,busy,send}:{payment:RecoveryPayment;kind:'employee'|'partner';busy:boolean;send:(input:Record<string,unknown>)=>Promise<void>}){
 const [note,setNote]=useState('');const r=i.recovery;if(!r)return null;
 const replaced=r.replacements.some(link=>link.predecessor===i.reference),terminal=r.terminal;
 const exact={kind,reference:i.reference,version:i.version,sourceHash:i.source_hash};
 const prepare={action:`prepare_${kind}_payment`,payrollItemId:i.payroll_item_id,payableId:i.payable_id,destinationId:i.destination_id,instructionReviewed:true,note};
 return <section aria-label="Payment recovery"><h4>Recovery and replacement</h4>
 <p>{r.held?'This payment chain is held. Review the original references and current evidence before any further action.':replaced?'A replacement is already linked. The original claim and reference remain in the history.':i.status==='dispatch_claimed'?'The saved claim cannot be cancelled or submitted again. Replacement requires final provider evidence and independent approval.':'Unsent cancellations preserve the instruction history.'}</p>
 {i.status==='dispatch_claimed'&&<button disabled={busy} onClick={()=>void send({...exact,action:i.mode==='live'?'verify_live_payment':`verify_${kind}_test`})}>Verify original {i.mode} transfer</button>}
 {((i.status==='dispatch_claimed'&&terminal&&!replaced&&!r.held)||(i.status==='cancelled'&&!replaced&&!r.held&&i.current))&&<form className={styles.form} onSubmit={event=>{event.preventDefault();const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
 if(button.value==='cancelled')void send({...prepare,requestKey:'replace-unsent:'+i.reference,replacesCancelledReference:i.reference});
 else if(button.value==='propose')void send({...exact,action:`propose_${i.mode}_disposition`,evidenceId:terminal!.evidence_id,disposition:terminal!.disposition,evidenceReviewed:true,note});
 else if(button.value.startsWith('approve:')){const proposal=r.proposals.find(p=>p.id===button.value.slice(8));if(proposal)void send({...exact,action:`approve_${i.mode}_disposition`,proposalId:proposal.id,evidenceId:proposal.evidence_id,disposition:proposal.disposition,evidenceReviewed:true,note});}
 else if(button.value.startsWith('replace:'))void send({...prepare,requestKey:'replace-claim:'+button.value.slice(8),replacesReference:i.reference,recoveryApprovalId:button.value.slice(8)});
 }}><p>{terminal?`Current final evidence: ${terminal.disposition}.`:'The cancelled instruction has no submission claim.'}</p>
 <label>Recovery findings<textarea value={note} onChange={e=>setNote(e.target.value)} required minLength={3} maxLength={1200}/></label>
 <label><input type="checkbox" required/>I reviewed the original instruction, its history and the exact current evidence.</label>
 {i.status==='cancelled'?<button value="cancelled" disabled={busy}>Prepare replacement of unsent instruction</button>:<>
 <button value="propose" disabled={busy}>Propose final disposition</button>
 {r.proposals.filter(p=>p.instruction_version===i.version&&p.evidence_id===terminal?.evidence_id).map(p=>p.approval_id?<button key={p.id} value={'replace:'+p.approval_id} disabled={busy||!i.current}>Prepare independently authorized replacement</button>:<button key={p.id} value={'approve:'+p.id} disabled={busy}>Independently approve disposition</button>)}
 </>}
 </form>}
 {!!r.proposals.length&&<details><summary>Immutable recovery decisions</summary>{r.proposals.map(p=><p key={p.id}>{p.disposition} · {p.note} · proposed by {p.operator_id} · {p.approved_by?'approved by '+p.approved_by:'awaiting independent approval'}</p>)}</details>}
 {!!r.replacements.length&&<details><summary>Original and replacement references</summary>{r.replacements.map(link=><p key={link.reference}>{link.predecessor} → {link.reference}</p>)}</details>}
 </section>;
}
