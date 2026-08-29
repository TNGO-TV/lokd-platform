import assert from "node:assert/strict";
import test from "node:test";

import {
  DisabledProvider,
  assertTransition,
  identityTransitions,
  paymentTransitions,
} from "../app/lib/integration-core.ts";

test("identity and payment adapter state machines accept only declared transitions", () => {
  assert.doesNotThrow(() => assertTransition("submitted", "processing", identityTransitions));
  assert.doesNotThrow(() => assertTransition("cleared", "reconciled", paymentTransitions));
  assert.throws(() => assertTransition("verified", "processing", identityTransitions), /Invalid transition/);
  assert.throws(() => assertTransition("created", "reconciled", paymentTransitions), /Invalid transition/);
});

test("disabled providers fail closed through an explicit health result", async () => {
  const provider = new DisabledProvider("iidentifii", "identity");
  const health = await provider.health();
  assert.deepEqual(health, {
    state: "not_configured",
    checkedAt: health.checkedAt,
    detail: "identity provider credentials and production endpoint are not configured.",
  });
});
