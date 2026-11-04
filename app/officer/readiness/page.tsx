import Link from 'next/link';
import {requireLokdUser} from '../../lokd-auth';
import {PortalOnboardingSummary} from '../../components/portal-onboarding-summary';
export const dynamic='force-dynamic';
export const metadata={title:'Your application',robots:{index:false,follow:false}};
export default async function Page(){
 await requireLokdUser('/officer/readiness');
 return <main className="officer-production"><h1>Your application</h1><PortalOnboardingSummary scope="officer"/><section className="officer-work-card"><h2>Your details</h2><p>Keep your application and registration details up to date.</p><div className="officer-work-actions"><Link href="/signup?kind=officer">Update your application</Link><Link href="/officer/psira">Your PSIRA status</Link><Link href="/officer/agreements">Agreements</Link><Link href="/officer">Your account</Link></div></section></main>;
}
