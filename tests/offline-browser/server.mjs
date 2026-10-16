import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

// Run the native build with no credentials or data bindings. vinext 0.0.50's
// Node server passes undefined env to Worker entries, so use the same explicit
// empty-environment adapter as the existing rendered Worker tests instead.
globalThis.fetch = async () => { throw new Error('Offline browser server forbids outbound fetch'); };
const {default: worker} = await import('../../dist/server/index.js');
const origin = 'http://127.0.0.1:4173';
const assetsRoot = path.resolve('dist/client');
const contentTypes = {
  '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.json': 'application/json',
};
const assets = {async fetch(request) {
  const filename = path.resolve(assetsRoot, '.' + decodeURIComponent(new URL(request.url).pathname));
  if (!filename.startsWith(assetsRoot + path.sep)) return new Response('Not found', {status: 404});
  try {
    const bytes = await fs.readFile(filename);
    return new Response(bytes, {headers: {'content-type': contentTypes[path.extname(filename)] ?? 'application/octet-stream'}});
  } catch { return new Response('Not found', {status: 404}); }
}};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    // All APIs are fulfilled in Playwright. If interception regresses, never
    // hand an API request or write to the Worker (even an unbound local one).
    if (url.origin !== origin || !['GET', 'HEAD'].includes(req.method) || url.pathname.startsWith('/api/')) {
      res.writeHead(403); res.end('Offline browser server forbids API/write requests'); return;
    }
    if (url.pathname === '/__offline_ready') { res.writeHead(200); res.end('Native Worker loaded; empty bindings'); return; }
    const request = new Request(url, {method: req.method, headers: req.headers});
    const asset = await assets.fetch(request);
    const response = asset.status === 200 ? asset : await worker.fetch(request, {ASSETS: assets}, {
      waitUntil(promise) { promise.catch(error => console.error('Offline Worker background failure:', error)); },
      passThroughOnException() {},
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); res.writeHead(500); res.end('Offline browser server error'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Offline native Worker: ' + origin));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
