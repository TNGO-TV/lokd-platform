# Historical evidence archive

Old raw test logs and the superseded root V34 release note have been removed from the active tree. Their original paths remain recoverable from Git history at bd349ef1517051671d4c03d152b6028158e7cd09 and the separately verified archive. Existing historical reports may refer to those historical paths. They were never runtime dependencies.

Archive: /srv/ammosync/workspaces/lokd-retired-evidence-2026-09-23.tar.gz
SHA-256: 8500cdcf167b0ee81b7dca6583808cc142847fefe9a457b86b0b2a7170656a1d

Unused starter icons file.svg, globe.svg and window.svg were also removed after reference inspection. Database migrations and regression tests are retained because they still define and protect the current application.

The unused integration-core.ts prototype and its two isolated self-tests were retired after the runtime import audit found no application or maintenance-script consumers. The active integration-server and provider-specific controls retain their regression coverage. Those two source files are recoverable from the pre-cleanup Git history and existing v84 backup. Maintenance retention and the deferred provider receipt adapter were inspected and retained.
