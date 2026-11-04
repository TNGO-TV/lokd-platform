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

test('officer earnings reads approved payroll statements and reviewed hours',()=>{
 assert.match(officerSource,/Hours worked/);assert.match(officerSource,/Pay statements/);
 assert.match(officerSource,/payableMinutes/);assert.match(officerSource,/netCents/);
 assert.doesNotMatch(officerSource,/request_payout|usePilot|synthetic|demo/);
});

test("public navigation sends officers to the dedicated authenticated hostname", () => {
  assert.match(publicShellSource, /OFFICER_PORTAL_URL/);
  assert.doesNotMatch(publicShellSource, /href="\/officer">Officer portal/);
});
