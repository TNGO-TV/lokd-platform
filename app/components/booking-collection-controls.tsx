'use client';
import ActionConfirmation from './action-confirmation';
import styles from './signup-portal.module.css';
export type CollectionState={collections:{reference:string;order_id:string;client_id:string;case_version:number;source_hash:string;amount_minor:number;currency:string;mode:string;state:string;revision:number;current:boolean;checkout_url:string|null;evidence:unknown[]}[]};
export default function BookingCollectionControls({data,operations,busy,send}:{data:CollectionState;operations:boolean;busy:boolean;send:(body:Record<string,unknown>)=>Promise<boolean>}){
 return <section><h2>Booking collection</h2><p>Collections require an independent review before the client can open checkout. A successful transaction still needs settlement review before it funds service.</p>
 {operations&&<form className={styles.form} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void send({action:'prepare_collection',orderId:f.get('orderId'),caseVersion:Number(f.get('caseVersion')),mode:f.get('mode')});}}>
 <label>Service order<input name="orderId" required/></label><label>Client intake version<input name="caseVersion" type="number" min={1} required/></label><label>Provider mode<select name="mode"><option value="test">Test — no real funding</option><option value="live">Live — acceptance required before checkout</option></select></label><button disabled={busy}>Prepare collection for review</button></form>}
 {!data.collections.length&&<p>No booking collections are available.</p>}
 {data.collections.map(r=><article className={styles.card} key={r.reference}><h3>{r.order_id}</h3><p>{r.mode==='test'?'TEST · ':''}{r.currency} {(r.amount_minor/100).toFixed(2)} · {r.state.replaceAll('_',' ')}</p><p>Reference: {r.reference}</p><p>{r.current?'Current client and order binding':'Client or order changed — review required'}</p>
 {operations&&<details><summary>Review saved collection evidence</summary><p>Client: {r.client_id} · intake version {r.case_version}</p><p style={{overflowWrap:'anywhere'}}>Order source: {r.source_hash}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(r.evidence,null,2)}</pre></details>}
 {operations&&r.state==='prepared'&&<ActionConfirmation key={JSON.stringify(r)} label="Independently approve collection" disabled={busy||!r.current} acknowledgement="I independently reviewed this exact service order, client version, amount and provider mode." onConfirm={()=>send({action:'approve_collection',reference:r.reference,revision:r.revision,evidenceReviewed:true})}/>}
 {operations&&!['prepared','approved'].includes(r.state)&&<button disabled={busy} onClick={()=>void send({action:'verify_collection',reference:r.reference,revision:r.revision})}>Verify saved transaction</button>}
 {!operations&&r.state==='approved'&&<button disabled={busy||!r.current} onClick={()=>void send({action:'initialize_collection',reference:r.reference,revision:r.revision})}>{r.mode==='test'?'Open test checkout':'Open checkout'}</button>}
 {!operations&&r.current&&r.checkout_url&&r.state==='awaiting_checkout'&&<a href={r.checkout_url} rel="noreferrer" target="_blank">Continue {r.mode==='test'?'test ':''}checkout</a>}
 {['initializing','initialization_unknown'].includes(r.state)&&<p>The checkout outcome is uncertain. Operations must verify this reference; a replacement charge will not be created.</p>}
 </article>)}</section>;
}
