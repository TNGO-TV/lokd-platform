import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import Link from 'next/link';
import {requireLokdUser} from '../../../lokd-auth';
import {agreementHash} from '../../../lib/agreement-acceptance';
import styles from '../../../components/client-quotes-panel.module.css';

export const dynamic='force-dynamic';

export default async function AgreementRecordsPage(){
 await requireLokdUser('/client/agreements/records');
 const userId=(await headers()).get('x-lokd-verified-user-id');
 if(!userId||!env.DB)return <section className={styles.shell}><h1>Signed agreements</h1><p role="alert">Your agreements are unavailable. Please try again.</p></section>;
 let records:{id:string;role:string;receipt_json:string;receipt_hash:string;revoked_at:string|null}[];
 try{
  records=(await env.DB.prepare(`SELECT e.id,e.role,r.receipt_json,r.receipt_hash,v.revoked_at FROM production_signing_envelopes e
   JOIN agreement_acceptance_receipts r ON r.id='LIVE-SIGN-'||e.id
   LEFT JOIN agreement_receipt_revocations v ON v.receipt_id=r.id
   WHERE e.owner_user_id=? AND e.case_kind='client' AND e.role IN ('CLIENT_MSA','SERVICE_ORDER') ORDER BY e.issued_at DESC LIMIT 100`).bind(userId).all<typeof records[number]>()).results;
 }catch{return <section className={styles.shell}><Link href="/client/agreements">Back to quotes</Link><h1>Signed agreements</h1><p role="alert">Your agreements could not be loaded. Please try again.</p></section>;}
 const copies=await Promise.all(records.map(async row=>({row,valid:await agreementHash(row.receipt_json)===row.receipt_hash,receipt:JSON.parse(row.receipt_json)})));
 return <section className={styles.shell}><Link href="/client/agreements">Back to quotes</Link><h1>Signed agreements</h1><p>Your earlier service agreements are kept here. Accepted quotes and their terms are available in <Link href="/client/agreements">Quotes</Link>.</p>
 {!copies.length&&<p>No earlier signed agreements.</p>}
 {copies.map(({row,valid,receipt})=><article key={row.id} className={styles.card}><h2>{row.role==='CLIENT_MSA'?'Client service agreement':'Service order agreement'}</h2>{!valid?<p role="alert">This signed copy could not be verified. Contact LOKD Operations.</p>:<><p>Signed {new Date(receipt.acceptedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})} SAST</p>{row.revoked_at&&<p role="status">Revoked {new Date(row.revoked_at).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</p>}<p>Version {receipt.documentVersion}</p><div className={styles.wording}>{receipt.wording}</div><details><summary>Agreed service details</summary><dl>{Object.entries(receipt.context?.scope??{}).map(([key,value])=><div key={key}><dt>{key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ')}</dt><dd>{String(value??'')}</dd></div>)}</dl></details></>}</article>)}
 </section>;
}
