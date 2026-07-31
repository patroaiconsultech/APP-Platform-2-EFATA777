import test from "node:test";
import assert from "node:assert/strict";

import {
  assertResponseEnvelope,
} from "../src/contracts/responseEnvelope.mjs";
import {
  assertCanonicalIdentity,
} from "../src/contracts/message.mjs";
import {
  reconcileMessages,
} from "../src/state/reconcile.mjs";

const valid = {
  message_id: "m1",
  request_id: "r1",
  execution_id: "e1",
  thread_id: "t1",
  tenant_id: "tenant-a",
  agent_id: "Orion",
  agent_name: "Orion",
  display_name: "Orion",
  final_speaker: "Orion",
  turn_owner: "Orion",
  route_family: "explicit_agent",
  content: "ok",
  status: "success",
  role: "assistant",
  created_at: "2026-07-31T10:00:00Z",
};

test("canonical envelope passes", () => {
  assert.equal(assertResponseEnvelope(valid), valid);
});

test("display alias does not replace canonical ownership", () => {
  const aliased = {
    ...valid,
    display_name: "Atlas",
  };
  assert.equal(assertResponseEnvelope(aliased), aliased);
  assert.equal(aliased.turn_owner, "Orion");
});

test("divergent canonical ownership fails", () => {
  assert.throws(
    () =>
      assertCanonicalIdentity({
        ...valid,
        agent_name: "Chris",
      }),
    /PERSISTENCE_AGENT_MISMATCH/,
  );
});

test("missing request id fails", () => {
  assert.throws(
    () => assertResponseEnvelope({ ...valid, request_id: null }),
    /request_id/,
  );
});

test("reconcile deduplicates persisted messages", () => {
  assert.equal(reconcileMessages([valid, valid]).length, 1);
});
