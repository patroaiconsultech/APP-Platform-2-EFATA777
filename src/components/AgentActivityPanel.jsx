function statusLabel(status) {
  if (status === "success") return "Concluído";
  if (status === "error") return "Falhou";
  return "Analisando";
}


function AgentCard({ item }) {
  return (
    <article
      className={`agent-activity-card ${item.status ?? "running"}`}
    >
      <header>
        <span className="agent-avatar">
          {(item.displayName ?? item.agentId ?? "A")
            .slice(0, 1)
            .toUpperCase()}
        </span>
        <div>
          <strong>
            {item.displayName ?? item.agentId}
          </strong>
          <small>{statusLabel(item.status)}</small>
        </div>
        <span className="agent-status-dot" aria-hidden="true" />
      </header>

      {item.content ? (
        <p>{item.content}</p>
      ) : (
        <p className="agent-working">
          Preparando contribuição especializada…
        </p>
      )}

      {(item.model || item.tokenUsage) && (
        <footer>
          {item.model && <span>{item.model}</span>}
          {item.tokenUsage?.total_tokens != null && (
            <span>
              {item.tokenUsage.total_tokens} tokens
            </span>
          )}
        </footer>
      )}
    </article>
  );
}


export function AgentActivityPanel({
  contributors,
  ownerAgent,
  ownerDisplayName,
  interactionMode,
  phase,
}) {
  const visible =
    contributors.length > 0 ||
    (
      ["connecting", "streaming"].includes(phase) &&
      interactionMode !== "single"
    );

  if (!visible) return null;

  return (
    <section className="agent-activity-panel" aria-live="polite">
      <div className="activity-heading">
        <div>
          <span className="eyebrow">EXECUÇÃO MULTIAGENTE</span>
          <h3>
            {interactionMode === "roundtable"
              ? "Mesa redonda"
              : "Equipe em síntese"}
          </h3>
        </div>
        <span className="owner-chip">
          Owner: {ownerDisplayName ?? ownerAgent ?? "Orkio"}
        </span>
      </div>

      <div className="agent-activity-grid">
        {contributors.map((item) => (
          <AgentCard
            key={item.nodeId ?? item.agentId}
            item={item}
          />
        ))}
      </div>
    </section>
  );
}
