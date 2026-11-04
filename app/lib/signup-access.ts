/** Server-managed operations grants shared by sign-in and public intake review. */
export function operationsEmailAllowed(email: string, runtime: Record<string, unknown>) {
  const normal = email.trim().toLowerCase();
  if (!normal) return false;
  const parse = (value: unknown): unknown => {
    try { return typeof value === "string" ? JSON.parse(value) : null; } catch { return null; }
  };
  const includes = (value: unknown) => Array.isArray(value) && value.some(entry => typeof entry === "string" && entry.trim().toLowerCase() === normal);
  if (includes(parse(runtime.LOKD_OWNER_ACCESS_JSON)) || includes(parse(runtime.LOKD_OPERATIONS_ACCESS_JSON))) return true;
  const roles = parse(runtime.LOKD_ROLE_ACCESS_JSON);
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) return false;
  const grants = roles as Record<string, unknown>;
  return includes(grants.owners) || includes(grants.operations);
}
