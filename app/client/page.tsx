import ClientApp from "../components/client-app";
import PilotAccessDenied from "../components/pilot-access-denied";
import { principalHasRole, requirePilotPageRole } from "../lib/pilot-page-access";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const { user, principal } = await requirePilotPageRole("client", "/client");
  if (!principalHasRole(principal, "client")) return <PilotAccessDenied email={user.email} role="client" />;
  return <ClientApp />;
}
