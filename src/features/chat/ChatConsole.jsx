import { useMemo, useState } from "react";

import { AgentPicker } from "../../components/AgentPicker.jsx";
import { MessageBubble } from "../../components/MessageBubble.jsx";


export function ChatConsole({
  agents,
  selectedAgentId,
  onAgentChange,
  messages,
  streamState,
  onSend,
  onCancel,
  disabled,
}) {
  const [content, setContent] = useState("");
  const canSend = useMemo(
    () => content.trim().length > 0 && !disabled,
    [content, disabled],
  );
  const canCancel =
    Boolean(streamState.requestId) &&
    ["connecting", "streaming"].includes(streamState.phase);

  async function submit(event) {
    event.preventDefault();
    if (!canSend) return;
    const value = content.trim();
    setContent("");
    await onSend(value);
  }

  return (
    <section>
      <AgentPicker
        agents={agents}
        selectedAgentId={selectedAgentId}
        onChange={onAgentChange}
      />
      <div>
        {messages.map((message) => (
          <MessageBubble
            key={message.message_id}
            message={message}
          />
        ))}
        {streamState.content && (
          <article className="message assistant">
            <header>{selectedAgentId}</header>
            <p>{streamState.content}</p>
          </article>
        )}
        {streamState.phase === "cancelled" && (
          <div className="error-panel">
            Execução cancelada e encerrada.
          </div>
        )}
        {streamState.error && (
          <div className="error-panel">
            {streamState.error.message ?? streamState.error.code}
          </div>
        )}
      </div>
      <form onSubmit={submit}>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={disabled}
        />
        <button type="submit" disabled={!canSend}>
          {disabled ? "Transmitindo…" : "Enviar"}
        </button>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
          >
            Cancelar execução
          </button>
        )}
      </form>
    </section>
  );
}
