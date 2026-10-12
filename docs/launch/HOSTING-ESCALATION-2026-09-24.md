# LOKD intermittent latency before application invocation — open issue

Production v91; Sites project `appgprj_6a88a08505548191b266e9b711562ae3`; deployment `appgdep_6ab5697c497c8191be4afebe01dcc7b2`; environment revision 34.

The customer reports sluggish navigation. Removing speculative authenticated route prefetches reduced one actual client-page load from six extra route requests to none, but intermittent stalls remain on both the custom domain and native Sites URL. The task is not complete.

## Reproduction and evidence

GET `https://lokd.co.za/api/health/live` and `https://lokd-security.zenas-capetown.chatgpt.site/api/health/live` with curl from the Johannesburg VPS and the Windows machine. No credentials, authorization headers, cookies, request-body data, or private customer data are needed. The handler returns a fresh `checkedAt` timestamp immediately, without authentication, database or external network reads.

On 2026-09-24, the VPS observed these matching requests:

| URL host | Request start UTC | TTFB | JSON checkedAt UTC | Receive minus checkedAt | Ray | Application wall time |
|---|---|---:|---|---:|---|---:|
| lokd.co.za | 18:40:43.654683 | 2.778 s | 18:40:46.425 | 13.9 ms | a403eb50ee4025c1-JNB | 2 ms |
| lokd.co.za | 18:40:46.439107 | 3.521 s | 18:40:49.955 | 14.5 ms | a403eb624afb599e-JNB | 1 ms |
| native Sites | 18:40:50.082866 | 3.071 s | 18:40:53.149 | 12.1 ms | a403eb791bba90cf-JNB | 1 ms |
| native Sites | 18:40:53.161293 | 2.313 s | 18:40:55.467 | 13.2 ms | a403eb8c5ee03575-JNB | 1 ms |

Fast requests in the same series completed in approximately 35–53 ms, with receive-minus-checkedAt still 11–16 ms. Exact timestamps are preserved in HOSTING-TIMESTAMP-VPS.json.

Windows independently observed native Sites TTFB 2.275 s, start 18:41:28.161073 UTC, checkedAt 18:41:30.406 UTC, receive 18:41:30.478066 UTC, Ray a403ec67cdf9152c-CPT. Other requests in that series were faster. Cross-machine clock offsets mean before/after differences are indicative rather than synchronized distributed traces. The stable return interval and matched 1–2 ms application execution strongly place the multi-second stall before the application handler.

Earlier probes showed DNS and TLS completing in milliseconds and a tiny favicon taking seconds despite CF-Cache-Status HIT. IPv4 and IPv6 results were mixed. Reusing a cookie jar coincided with fast warmed requests, but fresh-cookie requests also became fast, so cookie causality is unproven. Expected JSON/status200 and no cf-mitigated header were observed; this rules out an observed challenge page, not all edge processing.

The exact v91 Worker startup profile used approximately 11.8 ms active CPU (92.9 ms profile duration including 81.1 ms idle). This is a local Wrangler startup profile, not a production startup trace. Source audit found no health-path external work or response buffering. Stale build output in the canonical checkout was excluded; the profiled artifact came from the exact released source checkout.

## Needed from the hosting platform

Correlate the listed Rays/timestamps across the Sites dispatcher and Cloudflare edge. Supply dispatcher invocation/queue timing, edge TTFB, cache/security processing and Worker startup/dispatch traces for the slow and adjacent fast requests. Determine whether routing/cache revalidation, dispatch initialization or another pre-invocation stage accounts for the wait. Native Sites tools expose application logs but not these upstream traces.

No DNS, security-policy, subscription, audience or payment changes are justified by the current evidence. The user explicitly authorized sending this report to OpenAI Support. Its measurements and request were sent through the Help Center chat. AI support requested additional curl samples; all 40 sanitized follow-up samples were sent as HOSTING-SUPPORT-EVIDENCE-2026-09-24.pdf with a human/platform escalation request. Two slow, 36 fast and two intermediate responses occurred. The final static comparison and deployment/inactivity caveats below were also sent. Selected Escalate when offered; the chat visibly confirms **Escalation requested**. No platform trace, assigned specialist or human case reference has yet been received. Detailed submission receipt: HOSTING-SUPPORT-SUBMISSION-2026-09-24.md.

References: [Cloudflare execution wall time](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/#wall-time-per-execution), [Workers for Platforms dispatch](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/how-workers-for-platforms-works/), [HTTP request log timing fields](https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/zone/http_requests/).

## Same-window health and cached static comparison — 19:19 UTC

Support requested a static asset comparison during the same window. A final bounded batch sent two groups of four parallel GET requests from the same Johannesburg VPS: custom and native `/api/health/live`, and custom and native `/favicon.svg`. The SVG is an existing asset, not the absent `/favicon.ico`. Each request used a fresh curl process with default curl configuration disabled; no authentication or cookies were sent. Full response headers and verbose diagnostics were sanitized in memory before saving. Set-Cookie and credential-like header values are redacted. No further sampling followed this batch.

All eight requests returned HTTP 200. The first group started at 2026-09-24 19:19:12.048–.049 UTC:

| Host and path | TTFB | Cache response | CF-Ray |
|---|---:|---|---|
| lokd.co.za/api/health/live | 2.731261 s | Cache-Control: no-store | a40423ac699d73c5-JNB |
| lokd-security.zenas-capetown.chatgpt.site/api/health/live | 2.697125 s | Cache-Control: no-store | a40423ac6a9c93cf-JNB |
| lokd.co.za/favicon.svg | 3.619409 s | CF-Cache-Status: HIT | a40423ac58bc4fa7-JNB |
| lokd-security.zenas-capetown.chatgpt.site/favicon.svg | 3.196084 s | CF-Cache-Status: HIT | a40423ac69650feb-JNB |

Both static responses were 442-byte `image/svg+xml` assets with `Cache-Control: public, max-age=0, must-revalidate`. Neither supplied an Age or Server-Timing header. The custom health response had `checkedAt=2026-09-24T19:19:14.772Z` and finished locally at 19:19:14.786 UTC; the native health response had `checkedAt=2026-09-24T19:19:14.738Z` and finished locally at 19:19:14.752 UTC. The approximately 14 ms return intervals are consistent with the earlier finding that the multi-second wait precedes application response creation; these timestamps are not a synchronized platform trace.

The second group started at 19:19:16.676–.678 UTC. Custom/native health TTFB was 47.009/45.624 ms; custom/native favicon TTFB was 50.735/65.543 ms. Both static responses still reported HIT. Its Rays, in that order, were `a40423c95e55af07-JNB`, `a40423c95f6555b9-JNB`, `a40423c9598615d1-JNB` and `a40423c95f6773a0-JNB`. This provides four actual slow and four actual fast responses, including cached static assets, in one approximately five-second window. No new application-wall-time correlation is claimed for this exact batch.

The deployed baseline for this batch was v92, deployment `appgdep_6ab5746f20688191a5211422ace04609`, environment revision 34, succeeded at 19:05:47.546350 UTC. The owning agent confirmed no later deployment; v92 changed independent quote/signing reads and left the health handler unchanged. The earlier v91 analysis above remains historical evidence. Although the preceding health batch ended at 19:06:17.532 UTC, a separate application invocation of `/api/agreements/production` occurred at 19:12:53.161 UTC. Therefore **this evidence does not establish more than ten minutes of global inactivity**: the static comparison began about six minutes nineteen seconds after that known invocation.

Evidence files, containing all eight exact request timestamps, Rays, phases, response headers and sanitized curl verbose output:

- Local JSON: `C:\Users\marke\OneDrive\Documents\ChatGPT\LOKD Completion\HOSTING-SUPPORT-STATIC-20260924.json`; canonical copy: `docs/launch/HOSTING-SUPPORT-STATIC-20260924.json`. SHA256 `67b3607759834853ec6f2e7fbcbb22ad644e6759dc9691174a6bcec6416a0ff8`; 48,871 bytes.
- Local text: `C:\Users\marke\OneDrive\Documents\ChatGPT\LOKD Completion\HOSTING-SUPPORT-STATIC-20260924.txt`; canonical copy: `docs/launch/HOSTING-SUPPORT-STATIC-20260924.txt`. SHA256 `56b42a1aeb3d4a216e093e536df2a94b5158af40541497e0d042cb5b175ab13f`; 40,571 bytes.

The cache-hit static delays strengthen the request for upstream Sites/Cloudflare tracing. They do not identify the responsible platform component or establish a justified application, DNS or security-policy change.
