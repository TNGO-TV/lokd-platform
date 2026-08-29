import assert from "node:assert/strict";
import test from "node:test";

import { env } from "cloudflare:workers";
import { GET } from "../app/api/service-record/route.ts";

test("service-record export scopes its query to the authenticated pilot client", async () => {
  const bindings = [];
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({
    clients: { "client-a@lokd.example": "CL-A", "client-b@lokd.example": "CL-B" },
  });
  env.DB = {
    prepare() {
      return {
        bind(...values) {
          bindings.push(values);
          return { all: async () => ({ results: [] }) };
        },
      };
    },
  };
  try {
    const response = await GET(new Request("https://demo.lokd.co.za/api/service-record", {
      headers: { "oai-authenticated-user-email": "client-a@lokd.example" },
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.clientId, "CL-A");
    assert.deepEqual(bindings, [["CL-A", null, null]]);
  } finally {
    delete env.DB;
    delete env.LOKD_PILOT_ACCESS_JSON;
  }
});

test("service-record export denies an authenticated account without a client role", async () => {
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ clients: { "client@lokd.example": "CL-A" } });
  try {
    const response = await GET(new Request("https://demo.lokd.co.za/api/service-record", {
      headers: { "oai-authenticated-user-email": "outsider@lokd.example" },
    }));
    assert.equal(response.status, 403);
  } finally {
    delete env.LOKD_PILOT_ACCESS_JSON;
  }
});
