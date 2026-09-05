import type { PilotAction } from "./pilot-types";

export type PilotRole = "operations" | "client" | "officer" | "reviewer";

type PilotAccessConfig = {
  owners?: string[];
  operations?: string[];
  reviewers?: string[];
  clients?: Record<string, string>;
  officers?: Record<string, string>;
  // Explicitly bind a stable Clerk user ID to the existing LOKD principal.
  // These links are server-managed; signup/email matches cannot create them.
  clerkUsers?: Record<string, { principalEmail: string; displayName?: string }>;
};

export type PilotPrincipal = {
  email: string;
  displayName: string;
  owner: boolean;
  roles: PilotRole[];
  clientId: string | null;
  officerId: string | null;
  authUserId?: string;
};

export class PilotAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const allRoles: PilotRole[] = ["operations", "client", "officer", "reviewer"];

export const PUBLIC_DEMO_EMAIL = "public-demo@lokd.invalid";

export function publicDemoPrincipal(): PilotPrincipal {
  return {
    email: PUBLIC_DEMO_EMAIL,
    displayName: "Public demo visitor",
    owner: false,
    roles: [...allRoles],
    clientId: "CL-001",
    officerId: "OFF-001",
  };
}

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

function parseConfig(raw: string): PilotAccessConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as PilotAccessConfig)
      : {};
  } catch {
    return {};
  }
}

export function principalForEmailFromConfig(
  emailValue: string,
  displayName: string,
  rawConfig: string,
): PilotPrincipal {
  const email = normaliseEmail(emailValue);
  const config = parseConfig(rawConfig);
  const owners = emailSet(config.owners);
  const owner = owners.has(email);
  const roles = new Set<PilotRole>(owner ? allRoles : []);
  if (emailSet(config.operations).has(email)) roles.add("operations");
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

export function principalHasRole(principal: PilotPrincipal, role: PilotRole) {
  return principal.owner || principal.roles.includes(role);
}

export function principalForClerkUserFromConfig(userId: string, rawConfig: string): PilotPrincipal {
  const config = parseConfig(rawConfig);
  const links = config.clerkUsers;
  const link = links && typeof links === "object" && !Array.isArray(links)
    && Object.hasOwn(links, userId) ? links[userId] : undefined;
  if (!userId.startsWith("user_") || !link || typeof link !== "object"
    || typeof link.principalEmail !== "string" || !link.principalEmail.trim()) {
    return { email: "", displayName: "LOKD account", owner: false, roles: [], clientId: null, officerId: null, authUserId: userId };
  }
  const email = normaliseEmail(link.principalEmail);
  const displayName = typeof link.displayName === "string" && link.displayName.trim() ? link.displayName.trim() : email;
  return { ...principalForEmailFromConfig(email, displayName, rawConfig), authUserId: userId };
}

export function requireSameOriginJson(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new PilotAccessError("Use application/json for this request.", 415);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new PilotAccessError("Cross-site requests are not accepted.", 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new PilotAccessError("Cross-site requests are not accepted.", 403);
  }
}

export function roleForPilotAction(action: PilotAction["action"]): PilotRole {
  if (
    [
      "create_booking",
      "client_signoff",
      "create_client_service_request",
      "record_demo_arrival_check",
    ].includes(action)
  )
    return "client";
  if (
    [
      "accept_offer",
      "decline_offer",
      "update_service_preference",
      "update_flex_availability",
      "check_in",
      "complete_shift",
      "report_issue",
      "create_officer_service_request",
      "request_payout",
    ].includes(action)
  )
    return "officer";
  return "operations";
}
