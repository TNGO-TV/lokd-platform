'use client';
import ActionConfirmation from './action-confirmation';
export type CollectionState={collections:{reference:string;order_id:string;client_id:string;case_version:number;source_hash:string;amount_minor:number;currency:string;mode:string;state:string;revision:number;current:boolean;checkout_url:string|null;evidence:unknown[]}[]};
export default function BookingCollectionControls({data,operations,busy,send}:{data:CollectionState;operations:boolean;busy:boolean;send:(body:Record<string,unknown>)=>Promise<boolean>}){
 data={...data,collections:data.collections.filter(row=>row.mode==='live')};
 return <section className="client-finance"><h2>Payments</h2><p>Pay securely by card. Your payment status updates after the funds are received and checked.</p>
 {operations&&<form className="client-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void send({action:'prepare_collection',orderId:f.get('orderId'),caseVersion:Number(f.get('caseVersion')),mode:f.get('mode')});}}>
 <label>Service order<input name="orderId" required/></label><label>Client intake version<input name="caseVersion" type="number" min={1} required/></label><input name="mode" type="hidden" value="live"/><button disabled={busy}>Prepare collection for review</button></form>}
 {!data.collections.length&&<p>Your payment requests will appear here.</p>}
 {data.collections.map(r=><article className="client-finance-card" key={r.reference}><h3>{r.order_id}</h3><p>{r.currency} {(r.amount_minor/100).toFixed(2)} · {r.state.replaceAll('_',' ')}</p><p>Reference: {r.reference}</p><p>{r.current?'Ready for your booking':'Your booking details need to be checked'}</p>
 {operations&&<details><summary>Review payment records</summary><p>Client: {r.client_id} · intake version {r.case_version}</p><p style={{overflowWrap:'anywhere'}}>Order source: {r.source_hash}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(r.evidence,null,2)}</pre></details>}
 {operations&&r.state==='prepared'&&<ActionConfirmation key={JSON.stringify(r)} label="Independently approve collection" disabled={busy||!r.current} acknowledgement="I independently reviewed this exact service order, client version, amount and provider mode." onConfirm={()=>send({action:'approve_collection',reference:r.reference,revision:r.revision,evidenceReviewed:true})}/>}
 {operations&&!['prepared','approved'].includes(r.state)&&<button disabled={busy} onClick={()=>void send({action:'verify_collection',reference:r.reference,revision:r.revision})}>Verify saved transaction</button>}
 {!operations&&r.state==='approved'&&<button disabled={busy||!r.current} onClick={()=>void send({action:'initialize_collection',reference:r.reference,revision:r.revision})}>Pay by card</button>}
 {!operations&&r.current&&r.checkout_url&&r.state==='awaiting_checkout'&&<a href={r.checkout_url} rel="noreferrer" target="_blank">Continue checkout</a>}
 {['initializing','initialization_unknown'].includes(r.state)&&<p>We are checking this payment. Please contact LOKD before making another payment.</p>}
 </article>)}</section>;
}
