import { env } from 'cloudflare:workers';
import { testSurfacesEnabled } from './test-surface-policy';

import { isolatedRehearsalStorage, type RehearsalRuntime } from './test-surface-storage';
export { isolatedRehearsalStorage, type RehearsalRuntime } from './test-surface-storage';

// Legacy rehearsal handlers always receive the dedicated binding, never DB.
// Missing test bindings stay missing; there is deliberately no primary fallback.
export const rehearsalEnv = new Proxy(env, {
  get(target, property) {
    if (property === 'DB') return (target as RehearsalRuntime).TEST_DB;
    if (property === 'BUCKET') return (target as RehearsalRuntime).TEST_BUCKET;
    return Reflect.get(target, property);
  },
});

export async function blockedTestSurface(request: Request) {
  const runtime = env as RehearsalRuntime;
  const url = new URL(request.url);
  if (testSurfacesEnabled(runtime, url.hostname)) {
    // Modern sandbox handlers separately enforce their existing marked,
    // version-bound SANDBOX_DB policy before any read or write.
    if (url.pathname.startsWith('/api/sandbox/') || url.pathname === '/api/finance-workflows' || url.pathname.startsWith('/api/finance-workflows/')) return null;
    if (await isolatedRehearsalStorage(runtime)) return null;
  }
  return Response.json({error:'This testing endpoint is not available on this site.'}, {
    status:404, headers:{'cache-control':'private, no-store'},
  });
}
