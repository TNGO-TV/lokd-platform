/**
 * LOKD's own record of verified account emails, keyed by the stable user id the
 * sign-in boundary supplies. Notifications resolve recipients from here so no
 * external identity service is called when an email is sent.
 */
export async function recordVerifiedIdentity(db: D1Database, headers: Headers, now = new Date()): Promise<void> {
  const userId = headers.get("x-lokd-verified-user-id");
  const email = headers.get("x-lokd-verified-email");
  if (!userId || !email || userId.length > 200 || email.length > 320) return;
  const encoded = headers.get("x-lokd-verified-full-name");
  let fullName: string | null = null;
  if (encoded && headers.get("x-lokd-verified-full-name-encoding") === "percent-encoded-utf-8") {
    try { fullName = decodeURIComponent(encoded).slice(0, 200); } catch { fullName = null; }
  }
  const stamp = now.toISOString();
  const stale = new Date(now.getTime() - 3_600_000).toISOString();
  await db.prepare(`INSERT INTO identity_directory(user_id,email,full_name,status,updated_at) VALUES(?,?,?,'active',?)
    ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,full_name=excluded.full_name,updated_at=excluded.updated_at
    WHERE identity_directory.email<>excluded.email OR identity_directory.full_name IS NOT excluded.full_name OR identity_directory.updated_at<?`)
    .bind(userId, email.toLowerCase(), fullName, stamp, stale).run();
}

/** Returns the verified email for an active account, or null. */
export async function directoryEmail(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare("SELECT email FROM identity_directory WHERE user_id=? AND status='active'").bind(userId).first<{ email: string }>();
  return row?.email ?? null;
}
