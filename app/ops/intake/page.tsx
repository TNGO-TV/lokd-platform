import {requireOperationsPage} from '../../lib/operations-page-access';
import OperationalDeliveryPanel from '../../components/operational-delivery-panel';
import SignupPortal from '../../components/signup-portal';
export const dynamic='force-dynamic';
async function IntakePage({searchParams}:{searchParams:Promise<{kind?:string}>}){const kind=(await searchParams).kind==='client'?'client':'officer';await requireOperationsPage('/ops/intake?kind='+kind);return <><SignupPortal kind={kind} operations/><OperationalDeliveryPanel/></>;}

// Keep query-dependent auth in the rendered tree; the framework route probe omits search selectors.
export default function Page(props:Parameters<typeof IntakePage>[0]){return <IntakePage {...props}/>;}
