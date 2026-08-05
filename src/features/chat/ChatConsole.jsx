import { useMemo, useState } from "react";

import {
  AgentActivityPanel,
} from "../../components/AgentActivityPanel.jsx";
import {
  CapabilityProofPanel,
} from "../../components/CapabilityProofPanel.jsx";
import {
  ExecutionEvidenceBar,
} from "../../components/ExecutionEvidenceBar.jsx";
import { MessageBubble } from "../../components/MessageBubble.jsx";
import { VoiceCallPanel } from "../../components/VoiceCallPanel.jsx";
import {
  shouldSuggestRoundtable,
} from "../../presentation/messageView.mjs";
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
  if (phase === "done") return "Concluído";
  if (phase === "partial") return "Parcial";
  if (phase === "error") return "Falha";
  if (phase === "cancelled") return "Cancelado";
  return "Pronto";
}


export function ChatConsole({
  capabilities,
  selectedAgentId,
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
  api,
  activeThreadId,
  onHistoryRefresh,
  voiceActive,
  onVoiceActiveChange,
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

  const isBusy =
    ["connecting", "streaming"].includes(streamState.phase) ||
    voiceActive;
  const canCancel =
    Boolean(streamState.requestId) && isBusy;
  const roundtableSuggested = shouldSuggestRoundtable({
    content,
    selectedAgentId,
    interactionMode,
  });

  async function submit(event) {
    event.preventDefault();
    if (!composer.canSend || voiceActive) return;

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
              voiceActive ||
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

          <span className={`stream-indicator ${streamState.phase}`}>
            {phaseLabel(
              streamState.phase,
              realtimeEnabled,
            )}
          </span>
        </div>

        {roundtableSuggested && (
          <div className="mode-suggestion">
            <span>
              Este pedido parece exigir respostas individuais.
            </span>
            <button
              type="button"
              onClick={() =>
                onInteractionModeChange("roundtable")
              }
            >
              Usar Mesa redonda
            </button>
          </div>
        )}
      </div>

      <VoiceCallPanel
        api={api}
        threadId={activeThreadId}
        enabled={governance?.realtime_voice_enabled === true}
        selectedAgentId={selectedAgentId}
        interactionMode={interactionMode}
        onHistoryRefresh={onHistoryRefresh}
        onActiveChange={onVoiceActiveChange}
      />

      <AgentActivityPanel
        contributors={streamState.contributors}
        ownerAgent={streamState.ownerAgent}
        ownerDisplayName={streamState.ownerDisplayName}
        interactionMode={
          streamState.requestId
            ? streamState.interactionMode
            : interactionMode
        }
        phase={streamState.phase}
      />

      <ExecutionEvidenceBar state={streamState} />

      <CapabilityProofPanel
        capabilities={capabilities}
        selectedAgentId={selectedAgentId}
      />

      <div className="message-list">
        {messages.map((message) => (
          <MessageBubble
            key={message.message_id}
            message={message}
          />
        ))}

        {streamState.content && isBusy && (
          <article className="message assistant streaming-message">
            <header>
              {streamState.ownerDisplayName ??
                streamState.ownerAgent ??
                selectedAgentId}
              <span className="live-pill">LIVE</span>
            </header>
            <div className="message-content">
              <p>{streamState.content}</p>
            </div>
          </article>
        )}

        {streamState.phase === "cancelled" && (
          <div className="notice-panel warning">
            Execução cancelada e encerrada com evento terminal.
          </div>
        )}

        {streamState.phase === "partial" && (
          <div className="notice-panel partial-notice">
            <strong>Síntese parcial.</strong>
            <span>
              As contribuições validadas foram preservadas.
              A tentativa automática repetiu somente a síntese de Orkio.
            </span>
            {streamState.partialReason && (
              <small>
                Motivo: {streamState.partialReason}
              </small>
            )}
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
          disabled={composer.disabled || voiceActive}
        />

        <div className="composer-actions">
          <small>Ctrl/⌘ + Enter para enviar</small>
          <button
            type="submit"
            disabled={!composer.canSend || voiceActive}
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
