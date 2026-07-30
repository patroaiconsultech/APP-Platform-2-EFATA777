import { normalizeMessage } from "../contracts/message.mjs";

export function MessageBubble({ message }) {
  const safe = normalizeMessage(message);
  const assistant = safe.role === "assistant";
  return (
    <article className={assistant ? "message assistant" : "message user"}>
      <header>
        {assistant ? safe.display_name : "Você"}
      </header>
      <p>{safe.content}</p>
    </article>
  );
}
