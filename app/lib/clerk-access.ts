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
  const fallback = role ? WORKSPACE_PATHS[role] : "/";
  if (!requested || /[\\\x00-\x20]/.test(requested) || !requested.startsWith("/") || requested.startsWith("//")) return fallback;
  const url = new URL(requested, "https://lokd.local");
  const paths = ["/signup", ...Object.values(WORKSPACE_PATHS).flatMap(base =>
    ["", "/agreements", "/service", "/test-cycle", ...(base === "/client" ? [] : ["/identity", "/readiness", "/psira"]), ...(base === "/ops" ? ["/intake", "/security"] : [])].map(suffix => base + suffix))];
  if (url.origin !== "https://lokd.local" || !paths.includes(url.pathname)) return fallback;
  if (role && url.pathname !== fallback && !url.pathname.startsWith(fallback + "/")) return fallback;
  const allowed = url.pathname.endsWith("/readiness") ? ["applicantId", "officerId", "identityId"] : url.pathname.endsWith("/identity") ? ["caseId"] : url.pathname === "/ops/intake" || url.pathname === "/signup" ? ["kind"] : [];
  const query = new URLSearchParams();
  for (const key of allowed) { const value = url.searchParams.get(key); if (value && value.length <= 300 && !/[\x00-\x1f]/.test(value)) query.set(key, value); }
  return url.pathname + (query.size ? "?" + query.toString() : "");
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
