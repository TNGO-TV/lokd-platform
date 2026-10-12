# LOKD hosting latency investigation

Actual hosted measurements from 23 September 2026 UTC, before the cleanup release. These are anonymous HTTP probes, not a simulated test or browser performance trace.

| Request | CF-Ray | End-to-end | Worker wall time |
| --- | --- | --- | --- |
| Operations health GET | a3f766df69b50d06 | 3.722670 s | 2 ms |
| Portal health GET | a3f766c0edcb4ece | 3.925438 s | 3 ms |
| Main health GET | a3f766a979c04ebd | 1.125515 s | 3 ms |

All three returned HTTP 200, without redirects. The Worker version was cfb56dec-a2ed-4003-b784-e49bee7bd638. The Operations event timestamp was 1790143993364 milliseconds since Unix epoch. The dispatch namespace was production.

The provider-generated origin also took 4.688207 and 4.402864 seconds on health GETs. Some warmed custom-domain probes took about 0.04 seconds. The same main health endpoint subsequently took 0.701402 seconds from the Windows client. The delay varies by request and vantage point.

Application logs account for only a small portion of these slow probes. Hosting dispatch, isolate startup and upstream routing remain candidates; none is proven as the root cause. Inspect dispatch/startup timing using the request IDs above. Do not claim the authentication concurrency change fixes anonymous health latency: health routes bypass browser authentication.

No provider support message has been sent. The toolset exposes Worker invocation logs and deployment controls, but no underlying dispatch trace or hosting configuration for the upstream routing layer.

Raw local evidence: lokd-edge-comparison.json, lokd-request-audit-http.json and lokd-worker-audit-sanitized.json.
