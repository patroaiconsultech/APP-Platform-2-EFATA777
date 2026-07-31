import { normalizeMessage } from "../contracts/message.mjs";
export function reconcileMessages(serverMessages) {
  const byId = new Map();
  for (const raw of serverMessages ?? []) {
    const message = normalizeMessage(raw);
    if (!message.message_id) throw new Error("MESSAGE_ID_REQUIRED");
    byId.set(message.message_id, message);
  }
  return [...byId.values()].sort((a,b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
  );
}
