import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";
import { dependencyBoundary } from "./build/dependency-boundary";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// Native builds inherit real bindings and policy from wrangler.jsonc.
// The generated config is validated and deployed without a second build.
const nativeCf = process.env.LOKD_NATIVE_CF === "1";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = nativeCf
  ? {
      main: "./worker/index.ts",
      compatibility_flags: ["nodejs_compat"],
    }
  : {
      main: "./worker/index.ts",
      compatibility_flags: ["nodejs_compat"],
      // Revalidation windows are evaluated every minute. The service is
      // idempotent, so duplicate scheduler delivery cannot create duplicate
      // decisions or move an assignment twice.
      triggers: {
        crons: ["* * * * *"],
      },
      d1_databases: d1
        ? [
            {
              binding: d1,
              database_name: "site-creator-d1",
              database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
            },
          ]
        : [],
      r2_buckets: r2
        ? [
            {
              binding: r2,
              bucket_name: "site-creator-r2",
            },
          ]
        : [],
    };

export default defineConfig(async ({command}) => {
  const sandboxLocal=process.env.LOKD_LOCAL_SANDBOX_COMPLETION==='true';
  if(sandboxLocal&&command!=='serve')throw new Error('The sandbox database binding is local development only.');
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local",...(sandboxLocal?["portal.lokd.co.za","officers.lokd.co.za","operations.lokd.co.za"]:[])],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      dependencyBoundary(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: sandboxLocal?{...localBindingConfig,d1_databases:[...(localBindingConfig.d1_databases??[]),{binding:'SANDBOX_DB',database_name:'lokd-sandbox-completion-local',database_id:'00000000-0000-4000-8000-000000000002'}]}:localBindingConfig,
      }),
    ],
  };
});
