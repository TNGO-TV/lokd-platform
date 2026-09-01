export const PUBLIC_SITE_URL = "https://lokd.co.za";
export const CLIENT_PORTAL_URL = "https://portal.lokd.co.za";
export const OPERATIONS_PORTAL_URL = "https://operations.lokd.co.za";

export const PUBLIC_SITEMAP_PATHS = [
  "",
  "/security-services",
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

export function isOperationsPortalHost(hostname: string) {
  return hostname === "operations.lokd.co.za";
}
