import OperationalDeliveryPanel from '../../components/operational-delivery-panel';
import { requireLokdUser } from '../../lokd-auth';
import { principalForEmail,principalHasRole } from '../../lib/pilot-runtime';
import PilotAccessDenied from '../../components/pilot-access-denied';
import SignupPortal from '../../components/signup-portal';
export const dynamic='force-dynamic';
async function IntakePage({searchParams}:{searchParams:Promise<{kind?:string}>}){const kind=(await searchParams).kind==='client'?'client':'officer';const user=await requireLokdUser('/ops/intake?kind='+kind);if(!principalHasRole(principalForEmail(user.email),'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;return <><SignupPortal kind={kind} operations/><OperationalDeliveryPanel/></>;}

// Keep query-dependent auth in the rendered tree; the framework route probe omits search selectors.
export default function Page(props:Parameters<typeof IntakePage>[0]){return <IntakePage {...props}/>;}
