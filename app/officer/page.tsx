import OfficerApp from "../components/officer-app";
import PilotAccessDenied from "../components/pilot-access-denied";
import { principalHasRole, requirePilotPageRole } from "../lib/pilot-page-access";

export const dynamic = "force-dynamic";

export default async function OfficerPage() {
  const { user, principal } = await requirePilotPageRole("officer", "/officer");
  if (!principalHasRole(principal, "officer")) return <PilotAccessDenied email={user.email} role="officer" />;
  return <OfficerApp />;
}
