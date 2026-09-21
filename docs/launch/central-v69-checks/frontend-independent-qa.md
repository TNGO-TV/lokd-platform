# FE-BUILD-02 independent QA

Reviewed 2026-09-14. Candidate `0757682`, base `c358358d6ad1ad59ba2f8e39513928c343e5736b` in `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3b-a93f-7721-8861-e941dd214476/fe-build-02/source`.

Verdict: no functional integration blocker found in this frontend delta. This is acceptance of the bounded checkpoint, not the entire build, live readiness, genuine-account acceptance, or combined-backend acceptance.

## Concrete finding

P3 — committed CSV fails whitespace gate. `git diff --check c358358d..0757682` exits 2 with trailing-whitespace findings for all 42 CRLF lines of `docs/launch/fe-build-02/ROUTE-COVERAGE.csv` (starting line 1). The handoff's generic `git diff --check` pass cannot establish committed-patch cleanliness on a clean checkout. Normalize that CSV to LF during integration or explicitly configure the intended line-ending policy, then check the integrated delta. No runtime impact found.

## Independent review

Read applicable `/srv/ammosync/AGENTS.md`, usage-efficiency guidance, owner handoff, route inventory, app delta, and relevant test scenarios. Candidate checkout remained clean. No source edits, Sites calls, account harness, external API writes, or duplicate implementation.

- Finance receipt is no longer assigned into the parent workspace state. Document failures propagate to the form. Previous document data and draft DOM remain mounted during GET failures; decisions are disabled while status is unconfirmed. Preparation preserves its original request key on uncertain outcomes. Source refresh acknowledgment clears the checkbox before a new submission. Explicit document decision submitter values are validated.
- Query wrappers retain the same user/role guards within the rendered server component. Selectors are encoded into return destinations. No API, backend library, auth module, migration, dependency, provider, or payment-policy changes appear in this delta.
- Hash section navigation uses ordinary links and hashchange for Back. Existing owner tests cover mobile/desktop keyboard use, direct hashes and overflow. Hold/service history exposes already-returned protected records and keeps original data separate from linked attribution.
- Private passport target uses `_blank` with `noopener noreferrer`; verifier still takes fragment token into memory, clears fragment, uses a read-only POST and avoids browser storage. Existing access boundaries remain unchanged.

## Evidence independently checked

Parsed sibling `browser-final.json`: expected130, unexpected0, skipped0, flaky0, errors[]. Parsed `browser-intake.json`: expected8, unexpected0, skipped0, flaky0, errors[]. Reviewed final build, lint, type and contract logs; contract report records 25 passes, zero failures/skips. These are owner executions reused as evidence, not claimed independent reruns.

Ran one supplemental independent browser scenario not explicitly covered by the owner suite: document POST succeeds, then authoritative parent GET returns503. At mobile360 width the scheduled workspace and entered draft remain, original-reference warning is shown, separate request is disabled, and after refresh the retry reuses the identical request key. Two expected intercepted POSTs and zero browser errors. PASS.

Runner `/tmp/lokd-fe-qa-browser.mjs`; temporary fixture config `/tmp/lokd-fe-qa-vite.mjs`, cache `/tmp/lokd-fe-qa-vite-cache`; all non-local browser requests were blocked. Fixture on127.0.0.1:4293 was stopped after execution (PID1570414). Existing owner report showed suites completed; no owner preview/browser process was visible before starting. Sandbox denied local binding, and authorized escalation permitted the local-only fixture/browser; no auto-review rejection occurred.

## Remaining acceptance boundary

Handoff correctly retains missing production VerifyNow input/capture/consent/recovery contract and finance refund/dispute/reversal/credit-note UI contracts. These are remaining build requirements, not passed acceptance. Root must still reconcile backend checkpoints and obtain combined-build verification before declaring completion. Physical devices, assistive technology and genuine users/providers were not exercised.
