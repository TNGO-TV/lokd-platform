import {installRehearsal} from './fixtures/isolated-rehearsal.mjs';
import {D1} from './fixtures/production-identity-journey.mjs';
import assert from "node:assert/strict";
import test from "node:test";

import { env } from "cloudflare:workers";
import { GET } from "../app/api/service-record/route.ts";

test("service-record export scopes its query to the authenticated pilot client", async () => {
  const bindings = [];
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({
    clients: { "client-a@lokd.example": "CL-A", "client-b@lokd.example": "CL-B" },
  });
  const db=new D1();
  const prepare=db.prepare.bind(db);
  db.prepare=sql=>{
    const statement=prepare(sql),bind=statement.bind;
    statement.bind=(...values)=>{bindings.push(values);return bind(...values);};
    return statement;
  };
  installRehearsal(db,{stage:'prelaunch'});
  try {
    const response = await GET(new Request("https://demo.lokd.co.za/api/service-record", {
      headers: { "x-lokd-verified-email": "client-a@lokd.example" },
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.clientId, "CL-A");
    assert.deepEqual(bindings, [["CL-A", null, null]]);
  } finally {
    db.sql.close();
    delete env.DB;
    delete env.LOKD_PILOT_ACCESS_JSON;
  }
});

test("service-record export denies an authenticated account without a client role", async () => {
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ clients: { "client@lokd.example": "CL-A" } });
  const db=new D1();installRehearsal(db,{stage:'prelaunch'});
  try {
    const response = await GET(new Request("https://demo.lokd.co.za/api/service-record", {
      headers: { "x-lokd-verified-email": "outsider@lokd.example" },
    }));
    assert.equal(response.status, 403);
  } finally {
    db.sql.close();
    delete env.LOKD_PILOT_ACCESS_JSON;
  }
});
