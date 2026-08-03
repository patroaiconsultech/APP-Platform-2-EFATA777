function statusLabel(item) {
  const status = item.availability ?? item.status;
  if (["available", "active"].includes(status)) {
    return "Disponível";
  }
  if (status === "feature_gated") return "Sob gate";
  if (status === "planned") return "Planejada";
  return "Indisponível";
}


function CapabilityCard({ item }) {
  const status = item.availability ?? item.status;
  return (
    <article className={`capability-card ${status}`}>
      <header>
        <strong>{item.description}</strong>
        <span className={`capability-status ${status}`}>
          {statusLabel(item)}
        </span>
      </header>
      <p>
        Agente: {item.agent_id} · Runtime: {item.runtime}
      </p>
      {item.evidence?.length > 0 && (
        <div>
          <span className="capability-label">Evidência</span>
          <ul>
            {item.evidence.map((evidence) => (
              <li key={evidence}>{evidence}</li>
            ))}
          </ul>
        </div>
      )}
      {item.limitations?.length > 0 && (
        <div>
          <span className="capability-label">Limites</span>
          <ul>
            {item.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}


export function CapabilityProofPanel({
  capabilities,
  selectedAgentId,
}) {
  const visible =
    selectedAgentId === "Team"
      ? capabilities
      : capabilities.filter(
          (item) => item.agent_id === selectedAgentId,
        );

  if (!visible.length) return null;

  const available = visible.filter(
    (item) =>
      ["available", "active"].includes(
        item.availability ?? item.status,
      ),
  ).length;
  const planned = visible.filter(
    (item) =>
      (item.availability ?? item.status) === "planned",
  ).length;

  return (
    <details className="capability-proof-panel">
      <summary>
        Capacidades comprovadas
        <span>
          {available} disponíveis · {planned} planejadas
        </span>
      </summary>
      <div className="capability-proof-grid">
        {visible.map((item) => (
          <CapabilityCard
            key={item.capability_id}
            item={item}
          />
        ))}
      </div>
      <p className="capability-disclaimer">
        Planejado não significa implementado. Recomendações dos
        agentes não comprovam execução externa.
      </p>
    </details>
  );
}
