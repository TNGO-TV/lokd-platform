# LOKD Custom Host Asset Skew — 2026-09-26 (ZA)

Follow-on to `LOKD-PROPER-PATHWAYS-2026-09-26.md`. Goal: make custom hosts serve the same Worker+assets as workers.dev so path deep links work.

## Hard conclusion (proven)

**Custom-host traffic does NOT reach Workers `lokd-security` or `lokd-security-pathways`.**

`wrangler tail` while curling:

| Request target | Hits Worker? | HTTP result |
|---|---|---|
| `lokd-security.zenas-capetown.workers.dev/client/agreements/…` | **Yes** (`lokd-security`) | 307 + `return_to` |
| `lokd-security-pathways.zenas-capetown.workers.dev/client/agreements/…` | **Yes** (`lokd-security-pathways`) | 307 + `return_to` |
| `portal.lokd.co.za/client/agreements/…` | **No** (0 tail events) | 404 |
| `lokd.co.za/client/agreements/…` | **No** | 404 |
| `officers.lokd.co.za/…` | **No** | 404 |

API still shows Workers Custom Domains + zone routes bound to our scripts — but edge traffic for those hostnames is served by **something else** (vinext-like CSP / Clerk headers / old hashed assets `oStFDelW`, `cf-cache-status: HIT` on immutable `/assets/*`). That matches a leftover **ChatGPT Sites (or SaaS) hostname front-end**, not a failed wrangler asset upload.

DNS fingerprint (A):

- apex/www → `162.159.143.30`, `172.66.3.26` (SaaS / custom-hostname style anycast)
- portal/officers/operations → `104.18.22.186`, `104.18.23.186`
- workers.dev → `104.21.11.101`, `172.67.165.185`

## What we tried (all insufficient alone)

1. **Diagnose** — header/asset compare; homepage `cache-control: private, no-store` but still old SSR fingerprints on custom hosts.
2. **Force asset re-upload** — unique CSS `--lokd-build-id`, `public/lokd-build-stamp.txt`, force file. Wrangler uploaded 3 then 65 assets. workers.dev shows stamp `1790452598`, CSS `index-CQB3Bn-k.css`, JS `index-BjVAJWgT.js`. Custom hosts: stamp 404, new assets 404, old JS 200 HIT.
3. **Cache purge** — wrangler OAuth **401** on zone purge. `shot-bonus/.env.cloudflare.setup` token **removed** (empty). No CF purge token on ZA.
4. **Detach/reattach domains** — portal rebound to brand-new Worker `lokd-security-pathways` (full 65-asset upload, version `e9e017e0-c924-4fa3-b224-97082b1440c3`). workers.dev green; **portal still 404 / old assets**; tail proves portal never invoked that Worker. Portal then **restored** to `lokd-security`.
5. **Zone routes** — `*.lokd.co.za/*` → Worker scripts present; still no custom-host invocations in tail.
6. **Pages list** — empty in this account (no Pages project owning the names).

## Smoke table (final, PT 2026-09-26 ~13:04)

| Host | Deep link | Status | Notes |
|---|---|---|---|
| `lokd-security.zenas-capetown.workers.dev` | `/client/agreements/QUOTE-*` | **307** | `return_to` preserved; build stamp 1790452598 |
| `lokd-security-pathways.zenas-capetown.workers.dev` | `/client/agreements/QUOTE-*` | **307** | diagnostic Worker; full assets |
| `portal.lokd.co.za` | `/client/agreements/QUOTE-*` | **404** | never hits our Worker (tail) |
| `lokd.co.za` | `/client/agreements/QUOTE-*` | **404** | never hits our Worker |
| `officers.lokd.co.za` | `/officer/agreements/ENV-*` | **404** | never hits our Worker |
| `operations.lokd.co.za` | `/ops/agreements/QUOTE-*` | **404** | (same class) |
| All custom hosts | `/` or portal roots | **200/307** | served by other front-end; old asset gen |
| Apex/portal | `/assets/index-oStFDelW.js` | **200 HIT** | CDN immutable cache of old Sites/asset gen |
| Apex/portal | `/assets/index-BjVAJWgT.js` | **404** | new assets only on workers.dev |

## Worker versions

| Script | Version (latest known) | Role |
|---|---|---|
| `lokd-security` | `3ae71bc7-5676-4f2f-a40d-017c53879562` (asset-skew-force) / prior `20b5c5ae-…` | primary; pathways code OK on workers.dev |
| `lokd-security-pathways` | `e9e017e0-c924-4fa3-b224-97082b1440c3` | diagnostic twin; safe to delete later |

`wrangler.jsonc` name restored to `lokd-security`. Portal custom domain restored to `lokd-security`.

## Remaining blocker (click / DNS / Sites)

**Not an asset-upload bug.** Custom hostnames are answered by a non-`lokd-security*` edge (likely ChatGPT Sites / Cloudflare-for-SaaS still fronting ZA hostnames). Wrangler Custom Domains + routes in account `d7000a5708fdeb67be6e21ee40e9105e` do not see that traffic.

Unblocks (outside this Pathways stop — Sites retire still deferred by Jonathan unless he lifts it):

1. **DNS visibility + ownership** — zone DNS read/purge API token (OAuth lacks `purge_cache` / DNS read), confirm CNAMEs/origins for portal/apex; remove SaaS/Sites hostname targets.
2. **Sites retire / detach** for lokd.co.za hostnames so zone Worker Custom Domains actually receive requests.
3. Optional: delete diagnostic Worker `lokd-security-pathways` after Sites cutover.

No Jonathan homework unless he must click DNS/Sites in a dashboard we cannot API.

## Explicitly NOT done

- Sites retire / detach
- Homepage design
- Phase B live sends
- CN crossover
