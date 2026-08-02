import {
  normalizeMessage,
} from "../contracts/message.mjs";


export function MessageBubble({ message }) {
  const safe = normalizeMessage(message);
  const className =
    safe.role === "assistant"
      ? "message assistant"
      : "message user";

  return (
    <article className={className}>
      <header>
        {safe.role === "assistant"
          ? safe.display_name
          : "Você"}
      </header>
      <p>{safe.content}</p>
    </article>
  );
}
