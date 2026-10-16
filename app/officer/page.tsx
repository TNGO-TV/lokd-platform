import { pageTestSurfacesEnabled } from '../lib/test-surface-page';
import SignupPortal from "../components/signup-portal";
import { pilotStage } from "../lib/pilot-runtime";
import OfficerApp from "../components/officer-app";
import PilotAccessDenied from "../components/pilot-access-denied";
import { principalHasRole, requirePilotPageRole } from "../lib/pilot-page-access";

export const dynamic = "force-dynamic";

export default async function OfficerPage() {
  const { user, principal } = await requirePilotPageRole("officer", "/officer");
  if (pilotStage() !== "demo" || !await pageTestSurfacesEnabled()) return <SignupPortal kind="officer"/>;
  if (!principalHasRole(principal, "officer")) return <PilotAccessDenied email={user.email} role="officer" />;
  return <OfficerApp />;
}
