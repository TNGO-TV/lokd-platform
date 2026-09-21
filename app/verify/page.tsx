import {pilotStage} from '../lib/pilot-runtime';
import PassportView from '../components/passport-view';
import PrivatePassportVerifier from '../components/private-passport-verifier';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export const dynamic='force-dynamic';
export default function Page(){return pilotStage()==='demo'?<PassportView/>:<PrivatePassportVerifier/>;}
