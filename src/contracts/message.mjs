const CANONICAL_IDENTITY_FIELDS = [
  "agent_id",
  "agent_name",
  "final_speaker",
  "turn_owner",
];

export function assertCanonicalIdentity(message) {
  if (message.role !== "assistant") return message;
  const canonicalValues = CANONICAL_IDENTITY_FIELDS
    .map((field) => message[field])
    .filter(Boolean);
  if (!canonicalValues.length) {
    throw new Error("ASSISTANT_IDENTITY_REQUIRED");
  }
  if (new Set(canonicalValues).size !== 1) {
    throw new Error("PERSISTENCE_AGENT_MISMATCH");
  }
  if (!message.display_name) {
    throw new Error("ASSISTANT_DISPLAY_NAME_REQUIRED");
  }
  return message;
}

export function normalizeMessage(raw) {
  const message = {
    message_id: raw.message_id,
    request_id: raw.request_id ?? null,
    execution_id: raw.execution_id ?? null,
    route_family: raw.route_family ?? null,
    status: raw.status ?? null,
    error_code: raw.error_code ?? null,
    error_message: raw.error_message ?? null,
    thread_id: raw.thread_id,
    tenant_id: raw.tenant_id,
    role: raw.role,
    content: raw.content ?? "",
    agent_id: raw.agent_id ?? null,
    agent_name: raw.agent_name ?? raw.agent_id ?? null,
    display_name:
      raw.display_name ??
      raw.agent_name ??
      raw.agent_id ??
      null,
    final_speaker:
      raw.final_speaker ??
      raw.agent_name ??
      raw.agent_id ??
      null,
    turn_owner:
      raw.turn_owner ??
      raw.agent_name ??
      raw.agent_id ??
      null,
    created_at: raw.created_at,
  };
  return assertCanonicalIdentity(message);
}
