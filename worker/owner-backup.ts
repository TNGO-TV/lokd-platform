// Owner backup service: disabled by default, bounded by a configured expiry, read-only.
// The raw backup credential is never stored in source or hosted settings; only its SHA-256 verifier.
export const BACKUP_PATH = "/api/internal/owner-backup";
export interface BackupEnv { DB: D1Database; BUCKET: R2Bucket; LOKD_BACKUP_ENABLED?: string; LOKD_BACKUP_TOKEN_SHA256?: string; LOKD_BACKUP_EXPIRES_AT?: string }
const headers = { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
type Schema = { type: string; name: string; tbl_name: string; sql: string | null };
type Column = { name: string; type: string; pk: number; hidden: number };
async function schema(db: D1Database | D1DatabaseSession) {
  const result = await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name").all<Schema>();
  if (!result.success) throw new Error("Schema read failed");
  return result.results;
}
async function columns(db: D1Database | D1DatabaseSession, table: string) {
  const result = await db.prepare(`PRAGMA table_xinfo(${quote(table)})`).all<Column>();
  if (!result.success || !result.results.length) throw new Error("Column read failed");
  return result.results;
}
function rowSql(table: string, cols: Column[], rowid: string | null) {
  const cells = [...(rowid ? [{name:rowid}] : []), ...cols].map(c => {
    const q = quote(c.name);
    return `json_array(typeof(${q}),CASE typeof(${q}) WHEN 'blob' THEN hex(${q}) WHEN 'integer' THEN CAST(${q} AS TEXT) WHEN 'real' THEN printf('%!.26g',${q}) ELSE ${q} END)`;
  });
  return `SELECT json_array(${cells.join(',')}) AS encoded FROM ${quote(table)}`;
}
export async function ownerBackup(request: Request, env: BackupEnv): Promise<Response | null> {
  if (new URL(request.url).pathname !== BACKUP_PATH) return null;
  const absent = () => new Response("Not found", { status: 404, headers });
  const expiresAt = Number(env.LOKD_BACKUP_EXPIRES_AT);
  const expectedHash = env.LOKD_BACKUP_TOKEN_SHA256 || "";
  if (env.LOKD_BACKUP_ENABLED !== "true" || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 3600000 || !/^[a-f0-9]{64}$/.test(expectedHash)) return absent();
  if (request.method !== "POST" || request.headers.has("origin")) return absent();
  const token = request.headers.get("x-owner-backup-token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return absent();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), b => b.toString(16).padStart(2,"0")).join("");
  let difference = 0;
  for (let i=0;i<64;i++) difference |= digest.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  if (difference !== 0) return absent();
  if (Number(request.headers.get("content-length") || "0") > 8192) return json({error:"Request too large"},413);
  try {
    const reader = request.body?.getReader();
    let body = "", bytes = 0;
    const decoder = new TextDecoder();
    if (reader) while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return json({error:"Request too large"},413); }
      body += decoder.decode(part.value, {stream:true});
    }
    body += decoder.decode();
    const input = JSON.parse(body) as { action?: string; cursor?: string; key?: string; etag?: string; version?: string };
    if (input.action === "health") return json({ok:true,expires_at:expiresAt,read_only:true});
    if (input.action === "runtime") {
      const values: Record<string,unknown> = {}, bindings: string[] = [];
      const allowed = new Set(["CLERK_PUBLISHABLE_KEY","CLERK_SECRET_KEY","LOKD_APP_STAGE","LOKD_LIVE_SHIFT_SCAN","LOKD_OPERATIONS_MFA_REQUIRED","LOKD_PILOT_ACCESS_JSON","PAYSTACK_TEST_PUBLIC_KEY","PAYSTACK_TEST_SECRET_KEY","VERIFYNOW_API_KEY","VERIFYNOW_SANDBOX_ENABLED"]);
      for (const [key,value] of Object.entries(env)) {
        if (!allowed.has(key)) { if (value && typeof value === "object") bindings.push(key); continue; }
        if (value === null || ["string","number","boolean"].includes(typeof value)) values[key]=value;
        else bindings.push(key);
      }
      return json({values,bindings,captured_at:new Date().toISOString()});
    }
    if (input.action === "database") {
      const db = env.DB.withSession("first-primary");
      const before = await schema(db);
      const tables = before.filter(s => s.type === "table" && !s.name.toLowerCase().startsWith("_cf_") && (s.name === "sqlite_sequence" || !s.name.startsWith("sqlite_")));
      if (tables.length > 200 || tables.some(t => /CREATE\s+VIRTUAL\s+TABLE/i.test(t.sql || ""))) return json({error:"Snapshot requires provider export: unsupported schema"},422);
      const definitions: Array<{name:string;columns:Column[];rowid:string|null}> = [];
      // Sequential schema reads are bounded and avoid excessive concurrent D1 requests.
      for (const table of tables) {
        const cols = await columns(db,table.name);
        const rowid = /WITHOUT\s+ROWID/i.test(table.sql || "") ? null : ["rowid","_rowid_","oid"].find(n => !cols.some(c => c.name.toLowerCase() === n));
        if (rowid === undefined || cols.length > 100) return json({error:"Snapshot requires provider export: unsupported table"},422);
        definitions.push({name:table.name,columns:cols,rowid});
      }
      // D1 batch is transactional: all data reads and the final schema are one batch.
      // Bound the entire encoded result inside SQLite, before it enters Worker memory.
      const union = definitions.map((t,i) => `SELECT ${i} AS table_id, encoded FROM (${rowSql(t.name,t.columns,t.rowid)})`).join(" UNION ALL ") || "SELECT 0 AS table_id, '' AS encoded WHERE 0";
      const dataSql = `WITH cells AS (${union}), stats AS (SELECT COUNT(*) AS n, COALESCE(SUM(length(CAST(encoded AS BLOB))),0) AS bytes FROM cells) SELECT n, bytes, CASE WHEN bytes <= 4194304 AND n <= 20000 THEN (SELECT json_group_array(json_array(table_id,json(encoded))) FROM cells) ELSE NULL END AS payload FROM stats`;
      const results = await db.batch([db.prepare(dataSql),db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name")]);
      if (results.some(r => !r.success)) return json({error:"Snapshot query failed"},503);
      if (JSON.stringify(before) !== JSON.stringify(results[1].results)) return json({error:"Schema changed; retry snapshot"},409);
      const data = results[0].results[0] as {n:number;bytes:number;payload:string|null};
      if (data.payload === null) return json({error:"Snapshot exceeds bounded export limit; provider export required",rows:data.n,bytes:data.bytes},422);
      const rows = JSON.parse(data.payload) as Array<[number,unknown[]]>;
      const output = definitions.map(t => ({...t,rows:[] as unknown[][]}));
      for (const [index,row] of rows) output[index].rows.push(row);
      return json({format:"sqlite-typed-cells-v2",captured_at:new Date().toISOString(),schema:before.filter(s => !s.name.toLowerCase().startsWith("_cf_") && !s.tbl_name.toLowerCase().startsWith("_cf_")),excluded_provider_internal:before.filter(s => s.name.toLowerCase().startsWith("_cf_")).map(s=>s.name),tables:output});
    }
    if (input.action === "objects") {
      const options: R2ListOptions & {include: ("httpMetadata" | "customMetadata")[]} = {limit:500,include:["httpMetadata","customMetadata"],...(input.cursor?{cursor:input.cursor}:{})};
      const result = await env.BUCKET.list(options);
      return json(result);
    }
    if (input.action === "object") {
      if (typeof input.key !== "string" || !input.key || typeof input.etag !== "string" || typeof input.version !== "string") return json({error:"Key and etag required"},400);
      const object = await env.BUCKET.get(input.key,{onlyIf:{etagMatches:input.etag}});
      if (!object) return json({error:"Object absent"},404);
      if (!("body" in object) || object.version !== input.version) return json({error:"Object changed"},412);
      return new Response(object.body,{headers:{...headers,"content-type":"application/octet-stream","content-length":String(object.size),"x-backup-etag":object.etag,"x-backup-version":object.version}});
    }
    return json({error:"Unknown action"},400);
  } catch { return json({error:"Backup read failed; no application data was modified"},503); }
}
