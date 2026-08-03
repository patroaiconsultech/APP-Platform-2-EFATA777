import { summarizeTerminalEvidence } from "../realtime/sse.mjs";

function EvidenceItem({ label, value, active, warning }) {
  if (value == null || value === "") return null;
  const className = [
    "evidence-item",
    active ? "active" : "",
    warning ? "warning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}


function transportLabel(transport) {
  if (transport === "sse") return "SSE";
  if (transport === "http_json") return "HTTP JSON";
  return "não comprovado";
}



export function ExecutionEvidenceBar({ state }) {
  if (!state.requestId && state.phase === "idle") {
    return null;
  }

  const eventCount =
    state.eventCount ?? state.events?.length ?? 0;
  const terminalEvidence = summarizeTerminalEvidence(state);
  const terminalLabel = terminalEvidence.label;
  const terminalComplete = terminalEvidence.complete;
  const terminalWarning = terminalEvidence.warning;

  return (
    <section className="execution-evidence-bar" aria-live="polite">
      <div>
        <span className="eyebrow">EVIDÊNCIA DA EXECUÇÃO</span>
        <strong>
          {state.routeFamily ?? "rota em resolução"}
        </strong>
      </div>
      <div className="execution-evidence-items">
        <EvidenceItem
          label="Transporte"
          value={transportLabel(state.transport)}
        />
        <EvidenceItem
          label="Modo"
          value={state.interactionMode}
        />
        <EvidenceItem
          label="Eventos wire"
          value={
            state.transport === "sse"
              ? String(eventCount)
              : "n/a"
          }
        />
        <EvidenceItem
          label="Último evento"
          value={
            state.transport === "sse"
              ? state.lastEventId
              : null
          }
        />
        <EvidenceItem
          label="Owner"
          value={state.ownerDisplayName ?? state.ownerAgent}
        />
        <EvidenceItem
          label="Terminal"
          value={terminalLabel}
          active={terminalComplete}
          warning={terminalWarning}
        />
        <EvidenceItem
          label="Fonte terminal"
          value={state.terminalSource ?? "não comprovada"}
        />
        <EvidenceItem
          label="Tokens"
          value={state.tokenUsage?.total_tokens}
        />
        <EvidenceItem
          label="Latência"
          value={
            state.latencyMs != null
              ? `${state.latencyMs} ms`
              : null
          }
        />
      </div>
    </section>
  );
}
