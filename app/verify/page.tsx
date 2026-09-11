import {pilotStage} from '../lib/pilot-runtime';
import PassportView from '../components/passport-view';
import Link from 'next/link';
export const dynamic='force-dynamic';
export default function Page(){return pilotStage()==='demo'?<PassportView/>:<main className="pilot-access-shell"><section className="pilot-access-card"><h1>Officer verification</h1><p>No live Passport verification is available here yet. An application or registration number alone does not confirm identity or work eligibility.</p><Link href="/">Return to LOKD</Link></section></main>;}
