import {
  assertResponseEnvelope,
} from "../src/contracts/responseEnvelope.mjs";
import {
  reconcileMessages,
} from "../src/state/reconcile.mjs";

const sample = {
  message_id: "m1",
  request_id: "r1",
  execution_id: "e1",
  thread_id: "t1",
  tenant_id: "tenant-a",
  agent_id: "Orion",
  agent_name: "Orion",
  display_name: "Atlas",
  final_speaker: "Orion",
  turn_owner: "Orion",
  route_family: "explicit_agent",
  content: "ok",
  status: "success",
  role: "assistant",
  created_at: "2026-07-31T17:00:00Z",
};

assertResponseEnvelope(sample);
if (reconcileMessages([sample, sample]).length !== 1) {
  throw new Error("RECONCILE_DEDUP_FAILED");
}
console.log("contract checks passed");
