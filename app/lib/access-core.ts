export type AccessRole = "operations" | "client" | "officer" | "reviewer";

type AccessConfig = {
  owners?: string[];
  operations?: string[];
  reviewers?: string[];
  clients?: Record<string, string>;
  officers?: Record<string, string>;
};

export type AccessPrincipal = {
  email: string;
  displayName: string;
  owner: boolean;
  roles: AccessRole[];
  clientId: string | null;
  officerId: string | null;
};

export class AccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const allRoles: AccessRole[] = ["operations", "client", "officer", "reviewer"];

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function emailSet(values: unknown) {
  return new Set(
    Array.isArray(values)
      ? values
          .filter((value): value is string => typeof value === "string")
          .map(normaliseEmail)
      : [],
  );
}

function configuredEmails(raw: string) {
  try { return emailSet(JSON.parse(raw)); }
  catch { return new Set<string>(); }
}

function entityMap(values: unknown) {
  const result = new Map<string, string>();
  if (!values || typeof values !== "object" || Array.isArray(values))
    return result;
  for (const [email, entityId] of Object.entries(values)) {
    if (typeof entityId === "string" && entityId.trim())
      result.set(normaliseEmail(email), entityId.trim());
  }
  return result;
}

function parseConfig(raw: string): AccessConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AccessConfig)
      : {};
  } catch {
    return {};
  }
}

export function principalForEmailFromConfig(
  emailValue: string,
  displayName: string,
  rawConfig: string,
  operationsAccess = "",
  ownerAccess = "",
): AccessPrincipal {
  const email = normaliseEmail(emailValue);
  const config = parseConfig(rawConfig);
  const owners = emailSet(config.owners);
  const owner = Boolean(email) && (owners.has(email) || configuredEmails(ownerAccess).has(email));
  const roles = new Set<AccessRole>(owner ? allRoles : []);
  if (emailSet(config.operations).has(email)) roles.add("operations");
  // Separate server-managed lists preserve the existing redacted role map.
  // Ordinary Operations membership never implies owner approval authority.
  if (email && configuredEmails(operationsAccess).has(email)) roles.add("operations");
  if (emailSet(config.reviewers).has(email)) roles.add("reviewer");
  const clients = entityMap(config.clients);
  const officers = entityMap(config.officers);
  if (clients.has(email)) roles.add("client");
  if (officers.has(email)) roles.add("officer");
  return {
    email,
    displayName,
    owner,
    roles: [...roles],
    clientId: clients.get(email) ?? null,
    officerId: officers.get(email) ?? null,
  };
}

export function principalHasRole(principal: AccessPrincipal, role: AccessRole) {
  return principal.owner || principal.roles.includes(role);
}

export function requireSameOriginJson(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new AccessError("Use application/json for this request.", 415);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new AccessError("Cross-site requests are not accepted.", 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new AccessError("Cross-site requests are not accepted.", 403);
  }
}
