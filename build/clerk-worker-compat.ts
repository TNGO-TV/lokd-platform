import type { Plugin } from "vite";

// Clerk 7 retains CommonJS server-only guards inside these ESM modules.
// Preserve the guard as an ESM side-effect import so Vinext can enforce the
// server/client boundary without requiring a Node CommonJS loader in Workers.
export function clerkWorkerGuards(): Plugin {
  return {
    name: "lokd-clerk-worker-guards",
    enforce: "pre",
    transform(code, id) {
      if (!/\/node_modules\/@clerk\/nextjs\/dist\/esm\/app-router\/server\/(auth|currentUser)\.js(?:\?|$)/.test(id)) return null;
      const guard = /\brequire\(["']server-only["']\);?/g;
      if (!guard.test(code)) return null;
      return { code: `import "server-only";\n${code.replace(guard, "")}`, map: null };
    },
  };
}
