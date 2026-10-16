import {requireTestSurfacePage} from '../../lib/test-surface-page';
import {requireLokdUser} from '../../lokd-auth';
import {principalForEmail} from '../../lib/pilot-runtime';
import PilotAccessDenied from '../../components/pilot-access-denied';
import ProviderPaymentTest from '../../components/provider-payment-test';
export const dynamic='force-dynamic';
export default async function Page(){
 await requireTestSurfacePage();

 const user=await requireLokdUser('/ops/payment-test');
 if(!principalForEmail(user.email).owner)return <PilotAccessDenied email={user.email} role="operations"/>;
 return <ProviderPaymentTest/>;
}
