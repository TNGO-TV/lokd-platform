import { pageTestSurfacesEnabled } from '../lib/test-surface-page';
import SignupPortal from "../components/signup-portal";
import { pilotStage } from "../lib/pilot-runtime";
import ClientApp from "../components/client-app";
import PilotAccessDenied from "../components/pilot-access-denied";
import { principalHasRole, requirePilotPageRole } from "../lib/pilot-page-access";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const { user, principal } = await requirePilotPageRole("client", "/client");
  if (pilotStage() !== "demo" || !await pageTestSurfacesEnabled()) return <SignupPortal kind="client"/>;
  if (!principalHasRole(principal, "client")) return <PilotAccessDenied email={user.email} role="client" />;
  return <ClientApp />;
}
