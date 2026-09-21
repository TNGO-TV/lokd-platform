// HISTORICAL pre-fix reproduction: expected to fail after ID-SEC-01 hardening.
// Current regression: tests/request-body.test.mjs (public handlers cancel before full consumption).
import assert from 'node:assert/strict';
import {submitClientEnquiry} from '/srv/ammosync/workspaces/lokd-security/app/api/enquiries/route.ts';
let pulls=0,cancelled=false;
const chunks=16,chunkSize=65536;
const stream=new ReadableStream({pull(controller){if(pulls===chunks){controller.close();return;}pulls++;controller.enqueue(new Uint8Array(chunkSize).fill(32));},cancel(){cancelled=true;}});
const request=new Request('https://demo.lokd.co.za/api/enquiries',{method:'POST',headers:{'content-type':'application/json',origin:'https://demo.lokd.co.za'},body:stream,duplex:'half'});
const response=await submitClientEnquiry(request);
assert.equal(response.status,413);
assert.equal(pulls,chunks);
assert.equal(cancelled,false);
console.log(JSON.stringify({route:'/api/enquiries',authentication:'none',databaseAccess:'none',configuredCharacterLimit:14000,bodyBytesRead:pulls*chunkSize,status:response.status,cancelledBeforeEnd:cancelled}));
