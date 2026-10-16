export type TestSurfaceRuntime = {
  LOKD_APP_STAGE?: unknown;
  LOKD_TEST_SURFACES_ENABLED?: unknown;
};

// Test tools require both an explicitly enabled non-production deployment and
// a test host. Production domains cannot opt into synthetic behavior by flag.
export function testSurfacesEnabled(runtime: TestSurfaceRuntime, hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, '');
  const isolatedHost = host === 'demo.lokd.co.za' || host === 'localhost'
    || host === '127.0.0.1' || host === 'app.local' || host.endsWith('.chatgpt.site');
  return isolatedHost && runtime.LOKD_TEST_SURFACES_ENABLED === 'true'
    && (runtime.LOKD_APP_STAGE === 'prelaunch' || runtime.LOKD_APP_STAGE === 'demo');
}

const testApiRoots = ['/api/pilot', '/api/operations', '/api/platform', '/api/onboarding',
  '/api/specialist', '/api/passport', '/api/evidence', '/api/service-record', '/api/feedback',
  '/api/sandbox', '/api/test-cycle', '/api/identity', '/api/enrolment', '/api/agreements/test',
  '/api/provider-test', '/api/paystack/test', '/api/finance-workflows'];

export function isTestApi(pathname: string, method = 'GET') {
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch { /* The router rejects malformed escapes. */ }
  const path = decoded.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  // These descendants implement production account security and token lookup.
  if (path === '/api/operations/security' || path === '/api/passport/verify') return false;
  if (path === '/api/applications') return method !== 'POST';
  return testApiRoots.some(root => path === root || path.startsWith(root + '/'));
}

export function testSurfaceResponse(request: Request, runtime: TestSurfaceRuntime) {
  const url = new URL(request.url);
  if (!isTestApi(url.pathname, request.method) || testSurfacesEnabled(runtime, url.hostname)) return null;
  return Response.json({error: 'This testing endpoint is not available on this site.'}, {
    status: 404, headers: {'cache-control': 'private, no-store'},
  });
}
