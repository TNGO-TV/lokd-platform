import {requireTestSurfacePage} from '../../../../lib/test-surface-page';
import Link from 'next/link';
export const metadata={title:'Paystack test checkout return',robots:{index:false,follow:false}};
export default async function Page(){
 await requireTestSurfacePage();
return <main className="pilot-access-shell"><section className="pilot-access-card"><h1>Test checkout returned to LOKD</h1><p>This is the return page for a Paystack test transaction. Returning here does not confirm that a payment succeeded.</p><p>Check the transaction in your Paystack test dashboard. Signed webhook delivery is recorded separately; test transactions do not fund a booking or start a security service.</p><p><Link href="https://officers.lokd.co.za">Return to your Officer account to verify enrolment payment</Link></p><Link href="https://portal.lokd.co.za">Return to your Client account</Link></section></main>;}
