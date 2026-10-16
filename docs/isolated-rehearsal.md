# Isolated rehearsal deployments

Production hosts never expose legacy demo, sandbox or simulated-payment routes, even if a stage or feature flag is accidentally enabled. The public application POST and production security, passport verification, signing, payment and readiness APIs retain their own authorization rules.

An intentional rehearsal deployment requires all of the following:

- A supported test hostname (`demo.lokd.co.za`, localhost, `127.0.0.1`, `app.local`, or a Sites preview subdomain).
- `LOKD_APP_STAGE=demo` or `prelaunch` and explicit `LOKD_TEST_SURFACES_ENABLED=true`.
- For legacy rehearsal APIs, a separate `TEST_DB` containing the application schema followed by `scripts/isolated-rehearsal-marker.sql`. The primary `DB` must not contain that marker. Both a missing binding and bindings aliased to the marked database fail closed. Never apply the marker to production or the modern sandbox database.
- A dedicated `TEST_BUCKET` for legacy evidence fixtures. There is no fallback to the production bucket. All retained evidence operations also enforce the exclusive `rehearsal/v1/` object namespace: uploads/cleanup use generated keys, and reads/verification reject references outside it, including when bucket bindings alias the same physical storage. Bind this only to isolated test storage; do not copy personal records into it.
- Existing account, role, second-factor, ownership, revision and independent-review requirements still apply.

The modern sandbox and finance simulator routes continue to require their separate, version-bound `SANDBOX_DB` policies. The host/flag check supplements those checks. Neither database is substituted for the other.

The Worker normalizes the SSR Host header from its request URL and removes caller-supplied forwarding headers. API handlers repeat the boundary so routing aliases cannot bypass it. Test callbacks return to the isolated demo host. Live payment callbacks remain separate.

This change does not enable a deployment, create a binding or run a migration. Tests install the rehearsal marker only in disposable SQLite fixtures. Existing production records and historical test records are not deleted. Production service payment-mode filtering is tracked separately from this route boundary.
