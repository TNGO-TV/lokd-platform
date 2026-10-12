# LOKD hosting latency: correlated evidence

User reports sluggish public site and portals. Baseline v90/environment34, commit 452951992c5f8d336d34be734c669902b75fed04.

## Confirmed hosting-path delay

Six independent HTTPS health reads from existing Johannesburg VPS between 18:09:28 and 18:09:49 UTC all returned 200. External TTFB ranged 2631–3981 ms; DNS 0.6–4.2 ms and TLS complete by 8–15 ms. Exact CF-Ray matches in native Sites logs show Worker wall time 1–6 ms. This route skips Clerk authentication. Reproduced on both lokd.co.za, operations.lokd.co.za and native lokd-security.zenas-capetown.chatgpt.site. Consequently the bulk of this measured delay is outside this Worker's invocation; the evidence does not identify the precise upstream component or prove a cold-start cause.

Raw sanitized artifacts: HOSTING-LATENCY-20260924-FRESH.json and HOSTING-LATENCY-20260924-CORRELATED.json.

Representative correlation: a403bd8b295f5f95-JNB external 3981ms, Worker 6ms; a403bdf749631708-JNB native host external 3046ms, Worker 1ms. No request cookies, tokens or authorization headers are included.

## Confirmed avoidable application work

Opening actual authenticated client portal at 18:12:51 UTC triggered six speculative route fetches: /client.rsc, /client/agreements.rsc, /client/service.rsc, /client/sandbox.rsc, /client/test-cycle.rsc, /sign-out.rsc, alongside the required /api/signup. Per-request authentication fetches authoritative session and user in parallel. Earlier Operations opening generated nine speculative routes.

PR19 disables navigation/sign-out prefetch in WorkspaceShell, retaining normal client-side clicks and all authoritative auth/authorization checks. No token cache, auth bypass, dependency upgrade, schema or environment change. This does not fix the distinct external health delay. Exact-source CI and deployed request-count verification are required before claiming the application improvement.

## Remaining hosting investigation

Provider-side tracing must correlate these ray IDs through Sites dispatch and Cloudflare routing, beyond the exposed application Worker logs. No dispatch trace capability is currently exposed. No support message has been sent and no speculative DNS changes, paid upgrade or keep-warm workaround performed.
