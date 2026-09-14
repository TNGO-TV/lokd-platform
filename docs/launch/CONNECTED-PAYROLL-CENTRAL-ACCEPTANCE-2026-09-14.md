# Connected payroll — Central Command local acceptance

Extended the existing linked identity/workforce/service fixture through payroll consumption. No production application or migration changes, no deployment, real provider/person evidence, real transfer, new checkout or live enablement. All live locks remain unchanged.

## Corrected date-boundary fixtures

A disposable fixture clock aligns JavaScript Date and SQLite date/time functions, including fractional precision and modifiers. It advances monotonically and restores JavaScript time during test cleanup. No stored evidence timestamp is rewritten.

The legacy payroll fixture now starts at a deterministic21:52UTC. Its shift starts ten minutes later on the following South African date. The test first proves that attempting the pay period prematurely is rejected, advances both clocks beyond scheduled shift end, then completes service and executes every existing payroll/payment assertion. Production pay-period guards remain unchanged. The helper cannot be preserved in an exported SQLite file, so LOKD_PAYROLL_FIXTURE_EXPORT explicitly fails for this deterministic fixture; it is not a browser-account fixture.

A second legacy activation test used the evaluation time's South African date for a shift that started one minute earlier. At midnight these differ. It now derives the date from the actual start and deterministically runs at00:00:30 SAST, proving the previous-date start remains rejected by the elapsed-start guard. No guards were disabled.

## Connected acceptance

The new connected officer remains linked before activation. After check-in, both fixture clocks advance beyond scheduled shift end before service completion. Client signoff and independent service-pay review feed an actually prepared/independently reviewed payroll profile and synthetic policy via existing APIs.

Assertions cover exact timesheet ID/version/minutes/gross consumption, one allocation only, idempotent preparation, duplicate-source rejection, maker separation, stale and same-reviewer decision rejection, independent approvals and export, intended-officer visibility, and an export marked NOT_RELEASED. No employee/partner instruction or disbursement batch is created; direct paid-state mutation is rejected.

After workforce suspension, payroll runs/items/source allocations/snapshots/decisions and consumed assignment/workforce/service history remain byte-for-byte unchanged. This closes the prior missing connected payroll-consumption fixture. It does not prove actual money movement or genuine evidence acceptance.

## Independent verification

Independent reviewer `/root/payroll_independent_qa` passed all9 connected tests plus the targeted midnight activation test. Verified native SQLite clock parity, fractional time, modifiers, monotonic advancement and cleanup. Clock edge cases identified during review were corrected. No remaining actionable findings in reviewed scope.

TypeScript, changed-file lint and whitespace passed. Production source and migration history are unchanged, so prior build/browser evidence remains applicable; no new build/browser pass is claimed. Full combined regression: **348 passed, zero failed/skipped** (24.01 seconds). Earlier failed runs remain in the evidence folder rather than being counted as passes.

## Remaining readiness work

Usable identity review/disposition interfaces, human hold audit provenance and private token delivery remain outstanding. Finance documents must consume canonical paid/reversed projections accurately. Genuine provider/person/PSiRA, approved policies and sources, intended independent accounts, selected pilot workforce/service model, real-device acceptance and release authorization remain outstanding. The production payroll UTC-versus-SAST calendar convention still requires finance-owner acceptance; no convention was silently changed to make these tests pass.

Evidence folder: `docs/launch/connected-payroll-central-checks/`.
