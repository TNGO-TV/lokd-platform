import { getLOKDUser, requireLOKDUser, type LOKDUser } from "../lokd-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  principalHasRole,
  publicDemoPrincipal,
  type PilotPrincipal,
  type PilotRole,
} from "./pilot-access-core";
import { pilotStage, principalForClerkUser } from "./pilot-runtime";
import {
  isLegacyPublicDemoHost,
  requestHostname,
  workspaceRedirectForHost,
} from "./public-site";

export { pilotStage, principalHasRole, type PilotRole };

export async function requirePilotPageRole(role: PilotRole, returnTo: string): Promise<{ user: LOKDUser; principal: PilotPrincipal }> {
  const optionalUser = await getLOKDUser();
  const requestHeaders = await headers();
  const hostname = requestHostname(requestHeaders.get("host"));
  if (role !== "reviewer") {
    const workspaceRedirect = workspaceRedirectForHost(hostname, role);
    if (workspaceRedirect) redirect(workspaceRedirect);
  }
  const publicDemoFallback = pilotStage() === "demo"
    && (!hostname || isLegacyPublicDemoHost(hostname) || hostname.endsWith(".chatgpt.site"));
  if (publicDemoFallback) {
    const user = optionalUser ?? {
      id: "public-demo",
      displayName: "Public demo visitor",
      email: "public-demo@lokd.invalid",
      fullName: null,
    };
    const configuredPrincipal = optionalUser
      ? principalForClerkUser(optionalUser.id)
      : null;
    const principal = configuredPrincipal && principalHasRole(configuredPrincipal, role)
      ? configuredPrincipal
      : publicDemoPrincipal();
    return { user, principal };
  }
  const user = optionalUser ?? await requireLOKDUser(returnTo);
  const principal = principalForClerkUser(user.id);
  // The wrapper performs the role-specific denied render so an authenticated,
  // unassigned reviewer sees a helpful page rather than a redirect loop.
  void role;
  return { user, principal };
}
