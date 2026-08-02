import { useMemo, useState } from "react";

import { AgentPicker } from "../../components/AgentPicker.jsx";
import { MessageBubble } from "../../components/MessageBubble.jsx";
import {
  resolveComposerState,
} from "./composerState.mjs";


export function ChatConsole({
  agents,
  selectedAgentId,
  onAgentChange,
  messages,
  streamState,
  onSend,
  onCancel,
  hasActiveThread,
}) {
  const [content, setContent] = useState("");

  const composer = useMemo(
    () =>
      resolveComposerState({
        hasActiveThread,
        phase: streamState.phase,
        content,
      }),
    [
      hasActiveThread,
      streamState.phase,
      content,
    ],
  );

  const canCancel =
    Boolean(streamState.requestId) &&
    ["connecting", "streaming"].includes(
      streamState.phase,
    );

  async function submit(event) {
    event.preventDefault();
    if (!composer.canSend) return;

    const value = content.trim();
    setContent("");
    await onSend(value);
  }

  return (
    <section className="chat-console panel">
      <div className="chat-toolbar">
        <AgentPicker
          agents={agents}
          selectedAgentId={selectedAgentId}
          onChange={onAgentChange}
        />
        <span className="stream-indicator">
          {streamState.phase === "streaming"
            ? "Stream ativo"
            : "Pronto"}
        </span>
      </div>

      <div className="message-list">
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
            {streamState.error.message ??
              streamState.error.code}
          </div>
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={content}
          placeholder={composer.placeholder}
          onChange={(event) =>
            setContent(event.target.value)
          }
          disabled={composer.disabled}
        />

        <button
          type="submit"
          disabled={!composer.canSend}
        >
          {composer.label}
        </button>

        {canCancel && (
          <button
            className="cancel-button"
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
