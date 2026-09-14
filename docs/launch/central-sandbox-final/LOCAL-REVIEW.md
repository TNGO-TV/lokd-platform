# Review the integrated candidate locally

Open http://127.0.0.1:4405/officer/sandbox while the Central review servers are running. The labelled rehearsal toolbar switches between fictional Officer, Client, Operations proposer and Separate reviewer accounts. Its opaque local sessions do not exercise Clerk. Use Saved records & corrections to load existing submissions, versions, identity records and readiness. The service, finance, training/partner and presence sections use the same guarded application handlers against a separate disposable SQLite sandbox.

The candidate is local. https://demo.lokd.co.za remains deployed review v69. Manual review and automated reset-based tests must not run concurrently. The independent browser suite creates scenario prerequisites through application services; its assertions and manifests are in the browser evidence alongside ACCEPTANCE.md. Mocked response tests are explicitly counted separately from actual-handler cases.

## Restart if needed

Run each server in a separate terminal from `/srv/ammosync/workspaces/lokd-security`:

```sh
LOKD_LOCAL_HANDLER_FIXTURE=enabled LOKD_MERGED_HANDLER_FIXTURE=enabled LOKD_HANDLER_PORT=4406 node --experimental-loader=./tests/cloudflare-loader.mjs tests/integrated-browser/server.mjs
```

```sh
LOKD_UI_PORT=4405 LOKD_HANDLER_PORT=4406 node node_modules/vite/bin/vite.js --config tests/integrated-browser/vite.config.mjs --host 127.0.0.1 --strictPort
```

Both listeners are loopback-only and require the explicit fixture mode. External handler requests are disabled. The owner preview on ports4395/4396 is a separate checkpoint; leave it untouched. Stop Central review servers before rebuilding. No production migration, deployment or live enablement is part of this review procedure.

The accepted review session was restarted after the final build and seeded with the fictional training/identity scenario through application services (HTTP200). The preview returned HTTP200. Select a fictional role in the toolbar to open its authorized records. Automated tests are stopped.
