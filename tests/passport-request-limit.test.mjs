import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/passport/verify/route.ts';

test('anonymous passport verification cancels an oversized chunked body immediately', async () => {
  let reads=0,cancelled=false;
  const body=new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(1100));},cancel(){cancelled=true;}},{highWaterMark:0});
  const response=await POST(new Request('https://lokd.example/api/passport/verify',{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'}));
  assert.equal(response.status,413);
  assert.equal(cancelled,true);
  assert.equal(reads,2);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});

test('passport body limit counts bytes and preserves small-body validation', async () => {
  const request=body=>new Request('https://lokd.example/api/passport/verify',{method:'POST',headers:{'content-type':'application/json'},body});
  assert.equal((await POST(request(JSON.stringify({token:'é'.repeat(1100)})))).status,413);
  assert.equal((await POST(request('{'))).status,400);
  assert.equal((await POST(request('{}'))).status,400);
  assert.equal((await POST(request(JSON.stringify({token:'lokd_live_'+'a'.repeat(64)})))).status,503);
});
