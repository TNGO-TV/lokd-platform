export const PUBLIC_SITE_URL = "https://lokd.co.za";
export const CLIENT_PORTAL_URL = "https://portal.lokd.co.za";
export const OFFICER_PORTAL_URL = "https://officers.lokd.co.za";
export const OPERATIONS_PORTAL_URL = "https://operations.lokd.co.za";

export const PUBLIC_SITEMAP_PATHS = [
  "",
  "/security-services",
  "/armed-security",
  "/vip-protection",
  "/industries",
  "/locations/johannesburg",
  "/clients",
  "/officers",
  "/training",
  "/compliance",
  "/about",
  "/contact",
  "/join",
  "/privacy",
] as const;

export function canonicalUrl(path = "") {
  return `${PUBLIC_SITE_URL}${path}`;
}

export function requestHostname(value: string | null) {
  return ((value ?? "").split(":", 1)[0] ?? "").trim().toLowerCase();
}

export function isLegacyPublicDemoHost(hostname: string) {
  return hostname === "demo.lokd.co.za";
}

export function isClientPortalHost(hostname: string) {
  return hostname === "portal.lokd.co.za";
}

export function isOfficerPortalHost(hostname: string) {
  return hostname === "officers.lokd.co.za";
}

export function isOperationsPortalHost(hostname: string) {
  return hostname === "operations.lokd.co.za";
}

export type WorkspaceRole = "client" | "officer" | "operations";

const WORKSPACE_URLS: Record<WorkspaceRole, string> = {
  client: CLIENT_PORTAL_URL,
  officer: OFFICER_PORTAL_URL,
  operations: OPERATIONS_PORTAL_URL,
};

export function workspaceUrl(role: WorkspaceRole) {
  return WORKSPACE_URLS[role];
}

export function isWorkspacePortalHost(hostname: string) {
  return (
    isClientPortalHost(hostname) ||
    isOfficerPortalHost(hostname) ||
    isOperationsPortalHost(hostname)
  );
}

export function workspaceRoleForHost(
  hostname: string,
): WorkspaceRole | null {
  if (isClientPortalHost(hostname)) return "client";
  if (isOfficerPortalHost(hostname)) return "officer";
  if (isOperationsPortalHost(hostname)) return "operations";
  return null;
}

export function workspaceRedirectForHost(
  hostname: string,
  role: WorkspaceRole,
) {
  const expected = new URL(workspaceUrl(role)).hostname;
  if (isWorkspacePortalHost(hostname) && hostname !== expected) {
    return workspaceUrl(role);
  }
  if (hostname === "lokd.co.za" || hostname === "www.lokd.co.za") {
    return workspaceUrl(role);
  }
  return null;
}
