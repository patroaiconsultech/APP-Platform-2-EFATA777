import { assertCanonicalIdentity } from "./message.mjs";
const REQUIRED = [
  "message_id","request_id","execution_id","thread_id","tenant_id",
  "agent_id","agent_name","display_name","final_speaker","turn_owner",
  "route_family","status"
];
export function assertResponseEnvelope(raw) {
  for (const field of REQUIRED) {
    if (raw?.[field] === undefined || raw?.[field] === null || raw?.[field] === "") {
      throw new Error(`RESPONSE_ENVELOPE_FIELD_REQUIRED:${field}`);
    }
  }
  assertCanonicalIdentity({ ...raw, role: "assistant" });
  return raw;
}
