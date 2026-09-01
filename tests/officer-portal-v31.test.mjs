import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const officerSource = fs.readFileSync(
  new URL("../app/components/officer-app.tsx", import.meta.url),
  "utf8",
);
const publicShellSource = fs.readFileSync(
  new URL("../app/components/public-site-shell.tsx", import.meta.url),
  "utf8",
);

test("officer earnings presents the two agreed balances separately", () => {
  assert.match(officerSource, /Available for withdrawal/);
  assert.match(officerSource, /Awaiting approval/);
  assert.match(officerSource, /Withdraw available balance/);
  assert.match(officerSource, /action: "request_payout"/);
  assert.match(officerSource, /withdrawalQueuedCents/);
});

test("public navigation sends officers to the dedicated authenticated hostname", () => {
  assert.match(publicShellSource, /OFFICER_PORTAL_URL/);
  assert.doesNotMatch(publicShellSource, /href="\/officer">Officer portal/);
});
