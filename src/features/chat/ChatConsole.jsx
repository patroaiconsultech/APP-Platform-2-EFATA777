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
  disabled,
}) {
  const [content, setContent] = useState("");
  const canSend = useMemo(
    () => content.trim().length > 0 && !disabled,
    [content, disabled],
  );

  async function submit(event) {
    event.preventDefault();
    if (!canSend) return;
    const value = content.trim();
    setContent("");
    await onSend(value);
  }

  return (
    <section className="chat-console">
      <header className="chat-header">
        <div>
          <span className="eyebrow">REALTIME CONTRACT</span>
          <h2>Console multiagente</h2>
        </div>
        <AgentPicker
          agents={agents}
          selectedAgentId={selectedAgentId}
          onChange={onAgentChange}
        />
      </header>

      <div className="messages">
        {messages.map((message) => (
          <MessageBubble
            key={message.message_id}
            message={message}
          />
        ))}
        {streamState.content && (
          <article className="message assistant streaming">
            <header>{selectedAgentId}</header>
            <p>{streamState.content}</p>
          </article>
        )}
        {streamState.error && (
          <div className="error-panel">
            {streamState.error.message ?? streamState.error.code}
          </div>
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Digite uma missão para o agente selecionado…"
          disabled={disabled}
        />
        <button type="submit" disabled={!canSend}>
          {disabled ? "Transmitindo…" : "Enviar"}
        </button>
      </form>
    </section>
  );
}
