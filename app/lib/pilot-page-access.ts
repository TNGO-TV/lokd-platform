import { requireChatGPTUser, type ChatGPTUser } from "../chatgpt-auth";
import { principalHasRole, type PilotPrincipal, type PilotRole } from "./pilot-access-core";
import { pilotStage, principalForEmail } from "./pilot-runtime";

export { pilotStage, principalHasRole, type PilotRole };

export async function requirePilotPageRole(role: PilotRole, returnTo: string): Promise<{ user: ChatGPTUser; principal: PilotPrincipal }> {
  const user = await requireChatGPTUser(returnTo);
  const principal = principalForEmail(user.email, user.displayName);
  // The wrapper performs the role-specific denied render so an authenticated,
  // unassigned reviewer sees a helpful page rather than a redirect loop.
  void role;
  return { user, principal };
}
