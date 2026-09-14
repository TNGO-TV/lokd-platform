# Isolated Operations incident and recovery-disposition rehearsal

**Passed:1 actual-handler test,0 failures/skips.** Source: `tests/sandbox-operations-rehearsal.test.mjs`; execution: `operations-rehearsal.log`. Synthetic scenario only; no real staff contact, notification, provider call, deployment or live service. Existing tests separately covered incident handling and workforce dispositions; this new bounded test connects them after consumed payroll/payment history.

The fixture creates synthetic captured identity, independent PSiRA/officer/readiness review, signed workforce and an actual isolated assignment. It consumes completed client-confirmed service through independent pay review, exported payroll, a private payslip and injected-provider payment/recovery. After those records exist, the Officer reports a high-severity fictional incident. Operations acknowledges/investigates, prospectively suspends the exact engagement evidence and verifies the old passport is suspended. The completed shift cannot be reopened for check-in.

The hold investigator (`bridge-checker`) prepares an exact version-bound disposition tied to the incident reference. Its own decision is denied. A separate owner (`operations-rehearsal-independent-owner`) permits fresh replacement review; the original engagement and passport remain suspended. The independent incident reviewer resolves and closes the incident. Five incident events and human hold provenance remain present. Byte-for-byte comparisons prove unchanged consumed `shift_timesheets`, `payroll_items`, `production_payroll_snapshots`, `pay_item_sources` and `employee_payment_instructions` rows.

## Recorded synthetic responsibilities and timing

Policy: `lokd-sandbox-completion-v1`. Applicant: `user_identity`; incident operator and containment actor: `bridge-maker`; hold investigator and separate incident resolution reviewer: `bridge-checker`; disposition owner: `operations-rehearsal-independent-owner`. These are executable isolated role principals, not staffing or contact claims.

| Executed step | Synthetic actor | Real elapsed from fixture start |
| --- | --- | --- |
| Actual captured identity through paid consumed service | `user_identity` | 2215 ms |
| Incident reported, acknowledged and investigated | `bridge-maker` | 2217 ms |
| Workforce held and prior passport invalidated | `bridge-maker` | 2241 ms |
| Separate disposition authorizes fresh replacement only | `operations-rehearsal-independent-owner` | 2248 ms |
| Incident closed; five consumed ledgers byte-for-byte unchanged | `bridge-checker` | 2267 ms |

Measured scenario execution: 2267 ms (test runner about2279 ms). The incident/hold/disposition phases used a fixed synthetic scenario clock, 2026-09-14T23:48:01.000Z, after simulated duty completion. These wall-clock measurements are test execution timings, not an agreed operational RTO, staffing response guarantee or production benchmark. The first run expected a false check-in result, but the real handler correctly threw for a completed shift; the assertion was corrected to require that rejection before the passing rerun. No product source changed.

## Recovery boundary

Recovery here is an independently authorized **fresh replacement process** with old holds/history preserved. It does not restore old approvals or issue a replacement engagement/passport automatically. The separate actual two-employer connected test exercises fresh reviewed replacement sources and downstream service; this rehearsal tests the incident containment/disposition sequence.

Database restoration is separate: `tests/sandbox-recovery.test.mjs` and `recovery-rehearsal.log` prove encrypted snapshot/decrypt/restore and typed-cell equality in isolation. This Operations test does not claim a database restore, production rollback, actual off-host custody or a staffed service. Real staff contacts, approved operational response objectives and live rollout authority remain later operating inputs; they do not block this fictional rehearsal.
