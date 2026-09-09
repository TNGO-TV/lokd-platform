import OperationsApp from "../components/operations-app";
import PilotAccessDenied from "../components/pilot-access-denied";
import { pilotStage, principalHasRole, requirePilotPageRole } from "../lib/pilot-page-access";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const { user, principal } = await requirePilotPageRole("operations", "/ops");
  if (!principalHasRole(principal, "operations")) return <PilotAccessDenied email={user.email} role="operations" />;
  return <OperationsApp stage={pilotStage()} actorEmail={principal.email} owner={principal.owner} />;
}
