# Hosting response-time evidence — v89, 24 September 2026

Twelve anonymous HTTPS requests from the same execution host, two per path/domain: homepage and /api/health/live across lokd.co.za, www.lokd.co.za and the native Sites hostname. All returned200 without redirects. TLS completed within16ms. Time was predominantly spent awaiting the first byte; download added less than1ms.

Homepage totals ranged0.986–3.717seconds. The minimal health route ranged0.153–4.373seconds. Contemporaneous Worker records show homepage execution11–70ms and health execution1–9ms. See TIMINGS.json and TIMING-WORKER-LOGS.json. The native Sites hostname also shows variable delay; the symptom is not exclusive to custom-domain DNS.

Inference: this sample's dominant delay occurs outside recorded application Worker execution. These observations do not isolate a particular hosting component or prove a provider outage. They do not measure signed-in pages, users in other networks, or Core Web Vitals. Do not claim the latency is fixed or replace working application components without further evidence.

No support message was sent. This record is prepared for a hosting-side investigation if an authorised support channel becomes available. Next measurement should correlate per-request identifiers and routing/queue timing with the host's diagnostics, then repeat comparable requests after a specific change. Avoid repeating generic CSS optimisation as a remedy for the observed multi-second minimal-health response delay.
