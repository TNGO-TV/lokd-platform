import { getChatGPTUser, requireChatGPTUser, type ChatGPTUser } from "../chatgpt-auth";
import {
  principalHasRole,
  publicDemoPrincipal,
  type PilotPrincipal,
  type PilotRole,
} from "./pilot-access-core";
import { pilotStage, principalForEmail } from "./pilot-runtime";

export { pilotStage, principalHasRole, type PilotRole };

export async function requirePilotPageRole(role: PilotRole, returnTo: string): Promise<{ user: ChatGPTUser; principal: PilotPrincipal }> {
  const optionalUser = await getChatGPTUser();
  if (pilotStage() === "demo") {
    const user = optionalUser ?? {
      displayName: "Public demo visitor",
      email: "public-demo@lokd.invalid",
      fullName: null,
    };
    const configuredPrincipal = optionalUser
      ? principalForEmail(optionalUser.email, optionalUser.displayName)
      : null;
    const principal = configuredPrincipal && principalHasRole(configuredPrincipal, role)
      ? configuredPrincipal
      : publicDemoPrincipal();
    return { user, principal };
  }
  const user = optionalUser ?? await requireChatGPTUser(returnTo);
  const principal = principalForEmail(user.email, user.displayName);
  // The wrapper performs the role-specific denied render so an authenticated,
  // unassigned reviewer sees a helpful page rather than a redirect loop.
  void role;
  return { user, principal };
}
