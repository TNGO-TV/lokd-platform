# Dependency vulnerability review — 15 September 2026

User explicitly approved transmission of dependency names/versions to npm. `npm audit --json` completed and exited 1 because it found vulnerabilities; raw result: [npm-audit.json](npm-audit.json). No automatic dependency fix/install was run.

## Result

24 affected package entries: **1 critical, 16 high, 6 moderate, 1 low**. These counts include transitive and propagated dependency findings and are not 24 independent exploitable application flaws. There are 723 resolved dependency entries in npm metadata. Development-package classification does not alone establish absence from a deployed bundle: vinext and React Server Components are devDependencies but provide the compiled runtime.

| Package | Audit severity | Installed versions | Lock classification | Suggested resolution from scan |
| --- | --- | --- | --- | --- |
| @babel/core | low | 7.29.0 | development | True |
| @cloudflare/vite-plugin | high | 1.37.1 | development | @cloudflare/vite-plugin 1.54.9 |
| @esbuild-kit/core-utils | moderate | 3.3.2 | development | drizzle-kit 0.18.1 (major change) |
| @esbuild-kit/esm-loader | moderate | 2.6.5 | development | drizzle-kit 0.18.1 (major change) |
| baseline-browser-mapping | moderate | 2.10.30 | includes production dependency | True |
| brace-expansion | high | 1.1.14, 5.0.6 | development | True |
| browserslist | high | 4.28.2 | development | True |
| drizzle-kit | moderate | 0.31.10 | development | drizzle-kit 0.18.1 (major change) |
| esbuild | moderate | 0.18.20, 0.27.3, 0.28.0 | development | drizzle-kit 0.18.1 (major change) |
| fast-uri | high | 3.1.2 | development | True |
| fflate | moderate | 0.7.4 | development | True |
| image-size | high | 2.0.2 | development | vinext 1.0.0-beta.9 (major change) |
| js-yaml | high | 4.1.1 | development | True |
| miniflare | high | 4.20260515.0 | development | @cloudflare/vite-plugin 1.54.9 |
| nanoid | high | 3.3.12 | includes production dependency | True |
| next | critical | 16.2.6 | includes production dependency | next 16.3.5 |
| postcss | high | 8.4.31, 8.5.14 | includes production dependency | next 16.3.5 |
| react-server-dom-webpack | high | 19.2.6 | development | react-server-dom-webpack 19.3.0 |
| sharp | high | 0.34.5 | includes production dependency | @cloudflare/vite-plugin 1.54.9 |
| undici | high | 7.24.8 | development | @cloudflare/vite-plugin 1.54.9 |
| vinext | high | 0.0.50 | development | vinext 1.0.0-beta.9 (major change) |
| vite | high | 8.0.13 | development | vite 8.3.0 |
| wrangler | high | 4.92.0 | development | @cloudflare/vite-plugin 1.54.9 |
| ws | high | 8.18.0 | development | @cloudflare/vite-plugin 1.54.9 |

## Applicability and first upgrade priorities

1. **High priority: React Server Components 19.2.6.** The production artifact contains `react-server-dom-webpack-server.edge.production.js` and its client edge implementation. The [maintainer advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g) covers 19.2.6 and fixes the 19.2 branch in 19.2.8. It describes CPU/memory exhaustion from crafted server-function requests. No application `use server` directive was found, but the bundler supports RSC; do not dismiss this as development-only or claim that lack of source directives proves safety. No hostile RSC payload was sent to production. Upgrade the aligned React/ReactDOM/RSC family under compatibility tests.

2. **Critical package alert: Next 16.2.6.** [Next AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) is patched in 16.3.3 and involves the sharp/libheif image path; [Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) is also patched in 16.3.3. Current Worker imports vinext, runs on Cloudflare, and transforms images via the IMAGES binding, not the Next Node/sharp image server. Thus a critical remotely exploitable flaw in this deployed application is not established by the package alert. Update Next and matching tooling anyway, verify vinext compatibility and retain the distinction between installed-package and reachable-runtime findings.

3. **Build/development chain:** update compatible Vite/Cloudflare plugin/Wrangler/transitive tooling. Some Vite findings explicitly target Windows development servers; this workspace is Linux, but developer installations can differ. Keep development servers private and authenticated. Check actual bundle usage of image-size/fflate and other runtime-adjacent dependencies before treating all dev entries as harmless.

4. Do not blindly run `npm audit fix --force`: the reported drizzle-kit remedy proposes a major-version move to 0.18.1 from 0.31.10, and vinext proposes a major transition to 1.0.0-beta.9. These require deliberate compatibility validation. Prefer compatible transitive fixes and targeted upgrades before larger adapter/toolchain changes.

## Validation for a remediation round

- Update one compatible dependency family at a time, retain the lockfile and run the migration-splitter regression, types/lint, Sites build and affected frontend/server tests.
- Re-run the approved audit and report remaining advisory IDs and applicability, not just a lower count.
- Verify the compiled Worker runtime after RSC/adapter changes; an npm production-only scan would miss runtime code bundled from devDependencies.

[npm audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/) describes the package advisory scan; it does not certify application security.
