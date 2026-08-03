import { useMemo, useState } from "react";

import { AgentPicker } from "../../components/AgentPicker.jsx";
import {
  AgentActivityPanel,
} from "../../components/AgentActivityPanel.jsx";
import {
  InteractionModePicker,
} from "../../components/InteractionModePicker.jsx";
import { MessageBubble } from "../../components/MessageBubble.jsx";
import {
  resolveComposerState,
} from "./composerState.mjs";


function phaseLabel(phase, realtimeEnabled) {
  if (phase === "connecting") return "Conectando";
  if (phase === "streaming") {
    return realtimeEnabled
      ? "Realtime ativo"
      : "Executando";
  }
  if (phase === "error") return "Falha";
  if (phase === "cancelled") return "Cancelado";
  return "Pronto";
}


export function ChatConsole({
  agents,
  selectedAgentId,
  onAgentChange,
  interactionMode,
  onInteractionModeChange,
  realtimeEnabled,
  onRealtimeChange,
  messages,
  streamState,
  onSend,
  onCancel,
  hasActiveThread,
  governance,
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

  const isBusy = ["connecting", "streaming"].includes(
    streamState.phase,
  );
  const canCancel =
    Boolean(streamState.requestId) && isBusy;

  async function submit(event) {
    event.preventDefault();
    if (!composer.canSend) return;

    const value = content.trim();
    setContent("");
    await onSend(value);
  }

  function onKeyDown(event) {
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey)
    ) {
      submit(event);
    }
  }

  return (
    <section className="chat-console panel">
      <div className="chat-toolbar premium-toolbar">
        <div className="toolbar-primary">
          <AgentPicker
            agents={agents}
            selectedAgentId={selectedAgentId}
            onChange={onAgentChange}
          />
          <InteractionModePicker
            value={interactionMode}
            onChange={onInteractionModeChange}
            selectedAgentId={selectedAgentId}
            disabled={isBusy}
          />
        </div>

        <div className="runtime-controls">
          <button
            type="button"
            className={
              realtimeEnabled
                ? "realtime-toggle active"
                : "realtime-toggle"
            }
            onClick={() =>
              onRealtimeChange(!realtimeEnabled)
            }
            disabled={
              isBusy ||
              governance?.realtime_streaming_enabled !== true
            }
            aria-pressed={realtimeEnabled}
            title={
              governance?.realtime_streaming_enabled
                ? "Alternar streaming textual incremental"
                : "Realtime não está habilitado no backend"
            }
          >
            ⚡ Realtime textual
          </button>

          <button
            type="button"
            className="voice-toggle"
            disabled
            title="WebRTC de voz será liberado em gate separado"
          >
            🎙 Voz · próximo gate
          </button>

          <span className={`stream-indicator ${streamState.phase}`}>
            {phaseLabel(
              streamState.phase,
              realtimeEnabled,
            )}
          </span>
        </div>
      </div>

      <AgentActivityPanel
        contributors={streamState.contributors}
        ownerAgent={streamState.ownerAgent}
        ownerDisplayName={streamState.ownerDisplayName}
        interactionMode={interactionMode}
        phase={streamState.phase}
      />

      <div className="message-list">
        {messages.map((message) => (
          <MessageBubble
            key={message.message_id}
            message={message}
          />
        ))}

        {streamState.content && (
          <article className="message assistant streaming-message">
            <header>
              {streamState.ownerDisplayName ??
                streamState.ownerAgent ??
                selectedAgentId}
              <span className="live-pill">LIVE</span>
            </header>
            <p>{streamState.content}</p>
          </article>
        )}

        {streamState.phase === "cancelled" && (
          <div className="notice-panel warning">
            Execução cancelada e encerrada com evento terminal.
          </div>
        )}

        {streamState.error && (
          <div className="error-panel">
            {streamState.error.message ??
              streamState.error.code}
          </div>
        )}
      </div>

      <form className="composer premium-composer" onSubmit={submit}>
        <textarea
          value={content}
          placeholder={composer.placeholder}
          onChange={(event) =>
            setContent(event.target.value)
          }
          onKeyDown={onKeyDown}
          disabled={composer.disabled}
        />

        <div className="composer-actions">
          <small>Ctrl/⌘ + Enter para enviar</small>
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
              Interromper
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
