import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCanonicalIdentity,
  normalizeMessage,
} from "../src/contracts/message.mjs";

test("normalizes canonical assistant identity", () => {
  const message = normalizeMessage({
    message_id: "m1",
    thread_id: "t1",
    tenant_id: "tenant-a",
    role: "assistant",
    content: "ok",
    agent_id: "Orion",
    created_at: "2026-07-30T00:00:00Z",
  });
  assert.equal(message.agent_name, "Orion");
  assert.equal(message.final_speaker, "Orion");
  assert.equal(message.turn_owner, "Orion");
});

test("rejects divergent assistant identity", () => {
  assert.throws(
    () =>
      assertCanonicalIdentity({
        role: "assistant",
        agent_id: "Orion",
        agent_name: "Chris",
      }),
    /PERSISTENCE_AGENT_MISMATCH/,
  );
});

test("user message does not require agent identity", () => {
  assert.doesNotThrow(() =>
    assertCanonicalIdentity({
      role: "user",
      content: "olá",
    }),
  );
});
