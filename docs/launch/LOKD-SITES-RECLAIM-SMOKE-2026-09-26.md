# LOKD Sites Reclaim Smoke — 2026-09-26 (ZA)

Jonathan removed all ChatGPT Sites custom domains for LOKD (apex/www/portal/officers/operations). Sites project remains at `lokd-security.zenas-capetown.chatgpt.site` only.

**Authoritative peer result:** `LOKD-CF-POST-RECLAIM-SMOKE-RESULT-2026-09-26.md` (LOKD Security Fresh, ~13:39 PT) — **GREEN 15/15**, tip `BjVAJWgT`, deep links 307 + `return_to`.

This CoS Worker smoke (~13:39–13:40 PT) agrees; no further smoke or Sites DNS cleanup started.

## Smoke table (this worker)

| Host | Path | Status | Note |
|---|---|---|---|
| workers.dev | `/` | 200 | NEW: `BjVAJWgT` / `CQB3Bn-k`, build `1790452598` |
| workers.dev | `/client/agreements/QUOTE-smoke` | **307** | `return_to` preserved |
| workers.dev | `/assets/index-BjVAJWgT.js` | 200 HIT | |
| lokd.co.za | `/` | 200 | NEW tip `BjVAJWgT` |
| lokd.co.za | `/client/agreements/QUOTE-smoke` | **307** | `return_to=/client/agreements/QUOTE-smoke` |
| www.lokd.co.za | `/` | 200 | NEW tip |
| portal.lokd.co.za | `/` | 307 | → `/client` |
| portal.lokd.co.za | `/client/agreements/QUOTE-smoke` | **307** | `return_to` preserved |
| portal.lokd.co.za | `/assets/index-BjVAJWgT.js` | 200 HIT | |
| portal.lokd.co.za | `/assets/index-oStFDelW.js` | **404** | old gen gone |
| officers.lokd.co.za | `/` | 307 | → `/officer` |
| officers.lokd.co.za | `/officer/agreements/ENV-smoke` | **307** | `return_to` preserved |
| operations.lokd.co.za | `/` | 307 | → `/ops` |
| operations.lokd.co.za | `/ops/agreements/QUOTE-smoke` | **307** | `return_to` preserved |

## Worker hit confirmation

`wrangler tail lokd-security` while curling custom hosts — **all four hostnames invoked** the Worker:

- `portal.lokd.co.za/.../QUOTE-reclaim-tail` → Ok
- `lokd.co.za/.../QUOTE-reclaim-tail` → Ok
- `officers.lokd.co.za/.../ENV-reclaim-tail` → Ok
- `operations.lokd.co.za/.../QUOTE-reclaim-tail` → Ok

(Previously Sites/SaaS front-end: tail showed **zero** custom-host invocations.)

## Bindings / DNS (post-reclaim)

- Worker Custom Domains: all five → `lokd-security` production, enabled
- Zone routes: `*/lokd.co.za/*` patterns → `lokd-security`
- DNS A now standard CF proxy (`104.21.3.240`, `172.67.131.88`) — prior SaaS anycast (`162.159.143.x` / `172.66.x`) gone

## Remaining blockers

None for pathways reclaim smoke. Sites residual DNS cleanup / homepage design **not started** (steering stop).

## STOP

Green. No Sites reopen, no homepage design, no Phase B sends.
