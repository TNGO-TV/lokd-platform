# LOKD performance audit — 2026-09-22

Status: investigation, not performance sign-off. No application source changed during this audit. Current accepted source bd349ef1517051671d4c03d152b6028158e7cd09; v84/env31 remains deployed. User requires clean replacement of structurally faulty components, preserving accepted functionality.

## Actual hosted measurements
Anonymous curl from the VPS, two samples per route, followed by 20 small GET/HEAD health requests across five domains. No provider payments or customer messages sent. These are real hosted HTTP checks, not simulated tests or browser Core Web Vitals.

Homepage: zero redirects. Protected client and Operations routes: one expected sign-in redirect. All configured custom domains point to one current Worker. No evidence of stacked historical-build redirects in the inspected routing.

Matched Operations health request CF-Ray a3f766df69b50d06: 3.722670 seconds end-to-end, Worker wall time 2 milliseconds. Portal health a3f766c0edcb4ece: 3.925438 seconds overall, Worker wall time 3 milliseconds. This places most observed delay outside logged application invocation, without identifying its exact upstream cause. Generated hosting URL health GETs took 4.688207 and 4.402864 seconds; custom-domain warm samples sometimes took about 0.04 seconds. Twenty checks all returned 200 and zero redirects.

www.lokd.co.za failed TLS handshake and is absent from the attached Sites domain list. Do not bypass TLS; verify DNS and provision correct domain/certificate before considering this fixed.

## Source findings requiring measured follow-up
worker/clerk-auth.ts performs authoritative session lookup then user lookup serially for authenticated requests. Preserve revocation, verified primary email, MFA and identity-header protections in any replacement. Public routes also enter authentication. Root layout mounts Clerk provider globally. These are audit candidates, not proven explanations for anonymous infrastructure-probe delays.

worker/index.ts catches broad application exceptions with sign-in wording, obscuring attribution. Routing, auth, service failure reporting and timing boundaries need explicit design and regression tests before release.

No Chrome DevTools tool available: no Lighthouse, browser trace, LCP/INP or signed-in waterfall result claimed. User Chrome sessions are separate from the controlled IAB session.

## Continuation and release scope
operations@lokd.co.za registration confirmed by user screenshot. Supplemental Operations mapping changed to that address in env31, deployed successfully at 2026-09-23T06:05:50Z (appgdep_6ab36c289a6c8191ae2fa5315096c93d). Legacy pilot grants unchanged. User explicitly authorizes Operations to approve all; final owner capability implementation and independent approval controls still require work and verification.

Friday paid test must cover both EFT and card checkout. Real payments deferred during current checks. Final approved contract/terms files remain outstanding. UX cleanup note retained separately. Do not claim launch-ready.

Evidence: lokd-request-audit-http.json, lokd-edge-comparison.json, lokd-worker-audit-sanitized.json. Authenticated performance testing, full code audit, hosting-delay root cause and remediation, www TLS, release tests, and hosted acceptance remain outstanding.

