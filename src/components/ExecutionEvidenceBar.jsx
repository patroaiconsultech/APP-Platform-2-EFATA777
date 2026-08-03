function EvidenceItem({ label, value, active }) {
  if (value == null || value === "") return null;
  return (
    <span className={active ? "evidence-item active" : "evidence-item"}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}


export function ExecutionEvidenceBar({ state }) {
  if (!state.requestId && state.phase === "idle") {
    return null;
  }

  const eventCount = state.events?.length ?? 0;
  const terminalLabel = state.terminal
    ? state.error
      ? "error + done"
      : state.cancelled
        ? "cancelled + done"
        : state.agentDone
          ? "agent_done + done"
          : "done"
    : "aguardando done";

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
          label="Modo"
          value={state.interactionMode}
        />
        <EvidenceItem
          label="Eventos"
          value={String(eventCount)}
        />
        <EvidenceItem
          label="Owner"
          value={state.ownerDisplayName ?? state.ownerAgent}
        />
        <EvidenceItem
          label="Terminal"
          value={terminalLabel}
          active={state.terminal && !state.error}
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
