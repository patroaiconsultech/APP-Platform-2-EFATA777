import { normalizeMessage } from "../contracts/message.mjs";
export function MessageBubble({message}) {
  const safe = normalizeMessage(message);
  return <article className={safe.role === "assistant" ? "message assistant" : "message user"}>
    <header>{safe.role === "assistant" ? safe.display_name : "Você"}</header>
    <p>{safe.content}</p>
  </article>;
}
