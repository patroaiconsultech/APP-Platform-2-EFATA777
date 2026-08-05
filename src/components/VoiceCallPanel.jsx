
import { useEffect, useRef, useState } from "react";

import {
  RealtimeVoiceController,
} from "../voice/realtimeVoice.mjs";


const INITIAL_STATE = {
  phase: "idle",
  active: false,
  muted: false,
  reconnecting: false,
  partialTranscript: "",
  lastUserTranscript: "",
  assistantTranscript: "",
  lastCanonicalText: "",
  speaking: false,
  error: null,
};


function phaseLabel(phase) {
  const labels = {
    idle: "Pronto para chamada",
    requesting_microphone: "Solicitando microfone",
    connecting: "Conectando áudio",
    listening: "Ouvindo",
    processing: "Orkio está processando",
    speaking: "Orkio está falando",
    reconnecting: "Reconectando",
    closing: "Encerrando",
    closed: "Chamada encerrada",
    error: "Falha de voz",
  };
  return labels[phase] ?? phase;
}


export function VoiceCallPanel({
  api,
  threadId,
  enabled,
  selectedAgentId,
  interactionMode,
  onHistoryRefresh,
  onActiveChange,
}) {
  const controllerRef = useRef(null);
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    return () => {
      controllerRef.current?.end("replaced").catch(
        () => undefined,
      );
    };
  }, []);

  useEffect(() => {
    const interactionLocked =
      Boolean(state.active) ||
      ["requesting_microphone", "connecting", "reconnecting", "closing"].includes(
        state.phase,
      );
    onActiveChange?.(interactionLocked);
  }, [state.active, state.phase, onActiveChange]);

  const compatible =
    selectedAgentId === "Orkio" &&
    interactionMode === "single";
  const canStart =
    enabled &&
    Boolean(threadId) &&
    compatible &&
    !state.active &&
    !["connecting", "requesting_microphone"].includes(
      state.phase,
    );

  async function start() {
    const controller = new RealtimeVoiceController({
      api,
      onState: setState,
      onHistoryRefresh,
      onCanonicalTurn: () => undefined,
    });
    controllerRef.current = controller;
    try {
      await controller.start({
        threadId,
        consentGranted: true,
      });
    } catch {
      // Controller publishes the safe user-visible error state.
    }
  }

  async function end() {
    try {
      await controllerRef.current?.end("user_end");
    } catch {
      // Controller publishes the terminal error.
    }
  }

  function toggleMute() {
    const next = !state.muted;
    controllerRef.current?.setMuted(next);
  }

  return (
    <section
      className={
        state.active
          ? "voice-call-panel active"
          : "voice-call-panel"
      }
      aria-label="Chamada realtime por voz"
    >
      <div className="voice-call-heading">
        <div>
          <strong>Chamada por voz · Orkio</strong>
          <small>
            Áudio realtime com transcrição e histórico canônico.
          </small>
        </div>
        <span
          className={`voice-status ${state.phase}`}
          aria-live="polite"
        >
          {phaseLabel(state.phase)}
        </span>
      </div>

      {!enabled && (
        <p className="voice-gate-message">
          Voz desativada no backend. Ative somente após configurar
          provedor, retenção e migration da R0.7.0.
        </p>
      )}

      {enabled && !compatible && (
        <p className="voice-gate-message">
          A R0.7.0 é Orkio individual. Selecione Orkio e modo
          Individual antes de iniciar.
        </p>
      )}

      <div className="voice-actions">
        {!state.active ? (
          <button
            type="button"
            className="voice-start"
            onClick={start}
            disabled={!canStart}
            title={
              enabled
                ? "Iniciar chamada de áudio com Orkio"
                : "Voz não está habilitada no backend"
            }
          >
            🎙 Iniciar chamada
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={state.muted}
            >
              {state.muted ? "🔇 Ativar microfone" : "🔈 Silenciar"}
            </button>
            <button
              type="button"
              className="voice-end"
              onClick={end}
            >
              Encerrar chamada
            </button>
          </>
        )}
      </div>

      {(state.active ||
        state.partialTranscript ||
        state.lastUserTranscript ||
        state.assistantTranscript) && (
        <div className="voice-transcript" aria-live="polite">
          {(state.partialTranscript ||
            state.lastUserTranscript) && (
            <div className="voice-transcript-turn user">
              <span>Você · voz</span>
              <p>
                {state.partialTranscript ||
                  state.lastUserTranscript}
              </p>
              {state.partialTranscript && (
                <small>Transcrição parcial</small>
              )}
            </div>
          )}

          {(state.assistantTranscript ||
            state.lastCanonicalText) && (
            <div className="voice-transcript-turn agent">
              <span>Orkio · voz</span>
              <p>
                {state.assistantTranscript ||
                  state.lastCanonicalText}
              </p>
              {state.speaking && <small>Falando agora</small>}
            </div>
          )}
        </div>
      )}

      {state.error && (
        <div className="voice-error" role="alert">
          <strong>{state.error.code}</strong>
          <span>{state.error.message}</span>
        </div>
      )}

      <p className="voice-consent-note">
        Ao iniciar, o navegador solicitará acesso ao microfone. O
        áudio bruto não é persistido por padrão; transcrições finais
        e respostas canônicas permanecem na conversa.
      </p>
    </section>
  );
}
