import { getLokdUser, requireLokdUser, type LokdUser } from "../lokd-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  principalHasRole,
  type PilotPrincipal,
  type PilotRole,
} from "./pilot-access-core";
import { principalForEmail } from "./pilot-runtime";
import {
  requestHostname,
  workspaceRedirectForHost,
} from "./public-site";

export { pilotStage } from "./pilot-runtime";
export { principalHasRole, type PilotRole };

export async function requirePilotPageRole(role: PilotRole, returnTo: string): Promise<{ user: LokdUser; principal: PilotPrincipal }> {
  const optionalUser = await getLokdUser();
  const requestHeaders = await headers();
  const hostname = requestHostname(requestHeaders.get("host"));
  if (role !== "reviewer") {
    const workspaceRedirect = workspaceRedirectForHost(hostname, role);
    if (workspaceRedirect) redirect(workspaceRedirect);
  }
  const user = optionalUser ?? await requireLokdUser(returnTo);
  const principal = principalForEmail(user.email, user.displayName);
  // The wrapper performs the role-specific denied render so an authenticated,
  // unassigned reviewer sees a helpful page rather than a redirect loop.
  void role;
  return { user, principal };
}
