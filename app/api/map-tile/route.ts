import { mapTileRequest } from '../../lib/zone-map';
export async function GET(request: Request) {
  const url = mapTileRequest(request.url);
  if (!url) return new Response('Tile unavailable', { status: 400 });
  try {
    // Never forward workspace credentials, cookies or precise location to the
    // basemap provider. Only the fixed, validated public tile path is sent.
    const response = await fetch(url, { headers: { 'user-agent': 'LOKD Zone maps (https://lokd.co.za; info@lokd.co.za)', accept: 'image/png' }, redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) return new Response('Tile unavailable', { status: 502 });
    return new Response(response.body, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800', 'x-content-type-options': 'nosniff' } });
  } catch { return new Response('Tile unavailable', { status: 503 }); }
}
