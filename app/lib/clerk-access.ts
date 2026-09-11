import { workspaceRoleForHost, type WorkspaceRole } from "./public-site";

export const WORKSPACE_PATHS: Record<WorkspaceRole, string> = {
  client: "/client",
  officer: "/officer",
  operations: "/ops",
};

// A login selection is a destination, never a role grant. Avoid arbitrary
// return URLs and keep subdomain logins in their own workspace.
export function signInDestination(hostname: string, requested?: string): string {
  const role = workspaceRoleForHost(hostname);
  if (role) return WORKSPACE_PATHS[role];
  return (requested === "/signup" || Object.values(WORKSPACE_PATHS).includes(requested ?? "")) ? requested! : "/";
}

export function cleanIdentityHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.startsWith("x-lokd-verified-") || name.startsWith("oai-authenticated-user-")) headers.delete(name);
  }
  return headers;
}

export function verifiedPrimaryEmail(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string; verification: { status: string } | null }>;
}): string | null {
  const email = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  return email?.verification?.status === "verified" ? email.emailAddress : null;
}
