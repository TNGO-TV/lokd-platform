import { env } from 'cloudflare:workers';
// Legacy callers receive no storage binding and are denied before any work.
export const rehearsalEnv = new Proxy(env, {
  get(target, property) {
    if (property === 'DB' || property === 'BUCKET') return undefined;
    return Reflect.get(target, property);
  },
});
export async function blockedTestSurface(_request: Request): Promise<Response | null> {
  return Response.json({error: 'Not found.'}, {
    status: 404, headers: {'cache-control': 'private, no-store'},
  });
}
