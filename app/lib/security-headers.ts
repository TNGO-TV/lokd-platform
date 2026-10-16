// Shared by the router and Worker. Request-specific nonces are generated only by
// the Worker; caller-supplied CSP and nonce headers must never select the value.
export function contentSecurityPolicy(nonce?: string, development = false) {
  if (nonce && !/^[A-Za-z0-9+/=_-]{20,100}$/.test(nonce)) throw new Error('Invalid script nonce.');
  const clerkOrigin = development ? 'https://awake-gorilla-7447.clerk.accounts.dev' : 'https://clerk.lokd.co.za';
  return [
    "default-src 'self'", "base-uri 'self'", "form-action 'self'",
    "frame-ancestors 'none'", "object-src 'none'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}' ` : ''}${clerkOrigin} https://challenges.cloudflare.com https://*.protect.clerk.com`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://img.clerk.com https://lokd.co.za",
    "font-src 'self' data:",
    `connect-src 'self' ${clerkOrigin} https://*.protect.clerk.com:* https://clerk-telemetry.com https://*.clerk-telemetry.com`,
    "frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com",
    "worker-src 'self' blob:",
  ].join('; ');
}

export const baselineSecurityHeaders = {
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

export function secureRequest(request: Request) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
  const headers = new Headers(request.headers);
  // SSR routing must use the Worker URL, never a caller's forwarded host.
  headers.set('host', new URL(request.url).host);
  headers.delete('x-forwarded-host');
  headers.delete('forwarded');
  headers.set('content-security-policy', policy);
  headers.delete('content-security-policy-report-only');
  headers.set('x-lokd-script-nonce', nonce);
  return { request: new Request(request, { headers }), nonce, policy };
}

export function secureResponse(response: Response, policy: string) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(baselineSecurityHeaders)) secured.headers.set(name, value);
  // Preserve sandboxed attachment policies; normal HTML must match its SSR nonce.
  const html = secured.headers.get('content-type')?.split(';')[0].trim() === 'text/html';
  if (html && !secured.headers.has('content-disposition')) {
    secured.headers.set('content-security-policy', policy);
    secured.headers.set('cache-control', 'private, no-store');
  } else if (!secured.headers.has('content-security-policy')) {
    secured.headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  }
  return secured;
}
