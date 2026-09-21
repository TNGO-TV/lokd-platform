# Validation scope

Actual provider evidence is in PROVIDER-EVIDENCE.json. CRM insert, replay and search
ran against Zoho through the connected assistant. Email, Books comparisons and
application-runtime CRM dispatch tests use substituted transport in isolated local
SQLite stores; they are not provider acceptance.

The new tests cover atomic enquiry jobs, duplicate submission, leased concurrent
workers, exact CRM correlation and assignee, disabled/default gates, allowlists,
wrong-organisation rejection, refresh-origin rejection, immutable payload/recipient,
timeout replay, expired idempotency stop, email delivery polling, bounce handling,
Operations access and cross-origin denial, Books amount precision and document
binding failures. The production signing fixture additionally checks one queued
email per bound envelope, current named-signer resolution, safe authenticated link,
no wording/identity evidence in the message, and withdrawal cancellation. Existing
unauthorised-signer, stale context and activation checks remain intact.

Browser checks exercise mobile/desktop navigation, agreement expiry/exact wording,
queued-versus-sent display, disabled delivery, and clearing delivery data on denied
access. These browser responses are synthetic, not real sessions or provider sends.

Corrections retained: the first local npm audit hit restricted-network DNS and was
rerun with approved network access. The first full gate passed 522 tests but failed
one Worker-routing fixture because its data-URL bundle could not resolve the new
external Clerk SDK import. The fixture now resolves that SDK to its absolute module
URL; no callback authentication behavior was changed. The targeted routing check
passed after the correction. The final security.log and browser.log record the
subsequent complete gate and focused browser result.

No real payment, identity submission, customer email or physical-device test was
performed. No Paystack provider acceptance is claimed. Live collection and shift
scan remain gated; the owner-approved Operations MFA exception is preserved.

ZeptoMail-specific simulations cover accepted versus delivered, matching logs,
provider switching, private endpoint allowlisting, wrong receipt rejection, and
no resend after timeouts, 5xx, malformed responses or lost leases. These tests do
not establish a configured ZeptoMail account, verified domain or actual delivery.

Final local gate after ZeptoMail changes: 526 tests passed, zero failed/skipped;
audit zero known vulnerabilities, lint zero errors (three pre-existing warnings),
types, canonical schema and build passed. Focused browser suite: 16 passed.
