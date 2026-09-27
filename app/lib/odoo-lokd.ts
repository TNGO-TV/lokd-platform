/**
 * Thin LOKD → TNGO Odoo JSON-2 client — company 4 (LOKD Security) only.
 * Pattern copied from Shot Bonus lib/integrations/odoo-company.mjs (co3) / VPS JSON-2 transport.
 * Server-side only. No CN CRM / sale-matrix complexity.
 */
import {DeliveryError,type OperationalRuntime} from './operational-provider';

export const LOKD_ODOO_COMPANY_ID = 4 as const;
export const LOKD_ODOO_COMPANY_NAME = 'LOKD Security';
const PINNED_ORIGIN = 'https://tngo-tv.odoo.com';

type EnvOdoo = OperationalRuntime & {
 LOKD_ODOO_API_KEY?: string;
 LOKD_ODOO_COMPANY_ID?: string;
 LOKD_ODOO_JSON2_ORIGIN?: string;
};

function odooConfig(runtime: OperationalRuntime) {
 const env = runtime as EnvOdoo;
 const key = typeof env.LOKD_ODOO_API_KEY === 'string' ? env.LOKD_ODOO_API_KEY.trim() : '';
 if (!key || /[\r\n]/.test(key)) throw new DeliveryError('odoo_runtime_authorization_missing');
 const companyRaw = env.LOKD_ODOO_COMPANY_ID ?? String(LOKD_ODOO_COMPANY_ID);
 if (companyRaw !== String(LOKD_ODOO_COMPANY_ID)) throw new DeliveryError('odoo_company_lock_mismatch');
 const origin = (env.LOKD_ODOO_JSON2_ORIGIN ?? PINNED_ORIGIN).replace(/\/$/, '');
 if (origin !== PINNED_ORIGIN) throw new DeliveryError('odoo_origin_mismatch');
 return {key, origin, companyId: LOKD_ODOO_COMPANY_ID};
}

function assertSafeName(value: string, label: string) {
 if (!/^_?[A-Za-z][A-Za-z0-9._]*$/.test(value)) throw new DeliveryError(`odoo_invalid_${label}`);
}

/** Fixed-host JSON-2 call. Every request pins allowed_company_ids: [4]. */
export async function lokdOdooCall<T = unknown>(
 runtime: OperationalRuntime,
 model: string,
 method: string,
 params: Record<string, unknown> = {},
 transport: typeof fetch = fetch,
): Promise<T> {
 assertSafeName(model, 'model');
 assertSafeName(method, 'method');
 const {key, origin, companyId} = odooConfig(runtime);
 const prior =
  typeof params.context === 'object' && params.context && !Array.isArray(params.context)
   ? (params.context as Record<string, unknown>)
   : {};
 const body = {
  ...params,
  context: {...prior, allowed_company_ids: [companyId]},
 };
 const response = await transport(`${origin}/json/2/${model}/${method}`, {
  method: 'POST',
  redirect: 'error',
  credentials: 'omit',
  cache: 'no-store',
  headers: {
   Authorization: `bearer ${key}`,
   'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15000),
 });
 if (response.status === 401 || response.status === 403) {
  await response.body?.cancel();
  throw new DeliveryError('odoo_access_denied', 'blocked');
 }
 if (!response.ok) {
  await response.body?.cancel();
  throw new DeliveryError(`odoo_http_${response.status}`, response.status === 429 || response.status >= 500 ? 'retry_wait' : 'failed');
 }
 const text = await response.text();
 if (text.length > 1_000_000) throw new DeliveryError('odoo_response_too_large', 'failed');
 try {
  return JSON.parse(text) as T;
 } catch {
  throw new DeliveryError('odoo_invalid_json', 'failed');
 }
}

export async function assertLokdCompany(runtime: OperationalRuntime, transport: typeof fetch = fetch) {
 const rows = await lokdOdooCall<Array<{id: number; name: string; currency_id?: [number, string] | false}>>(
  runtime,
  'res.company',
  'search_read',
  {
   domain: [['id', '=', LOKD_ODOO_COMPANY_ID]],
   fields: ['id', 'name', 'currency_id'],
   limit: 2,
  },
  transport,
 );
 const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
 const currency =
  Array.isArray(row?.currency_id) && typeof row.currency_id[1] === 'string' ? row.currency_id[1] : '';
 if (!row || row.id !== LOKD_ODOO_COMPANY_ID || row.name !== LOKD_ODOO_COMPANY_NAME || currency !== 'ZAR') {
  throw new DeliveryError('odoo_company_not_verified');
 }
 return {organizationId: String(LOKD_ODOO_COMPANY_ID), name: LOKD_ODOO_COMPANY_NAME, currency: 'ZAR' as const};
}
