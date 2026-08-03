function statusLabel(status) {
  if (status === "success") return "Concluído";
  if (status === "refused") return "Recusado";
  if (status === "contract_violation") {
    return "Bloqueado por contrato";
  }
  if (status === "failed" || status === "error") {
    return "Falhou";
  }
  return "Analisando";
}


function fallbackContent(item) {
  if (item.status === "refused") {
    return "O agente recusou a contribuição; não foi marcada como sucesso.";
  }
  if (item.status === "contract_violation") {
    return "A contribuição foi bloqueada por violação do contrato de autoria.";
  }
  if (item.status === "failed" || item.status === "error") {
    return "A contribuição não ficou disponível por falha controlada.";
  }
  return "Preparando contribuição especializada…";
}


function AgentCard({ item }) {
  const detail = item.statusReason
    ? `Motivo: ${item.statusReason}`
    : null;

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
          {fallbackContent(item)}
        </p>
      )}

      {item.assignedTask && (
        <details className="agent-assigned-task">
          <summary>Tarefa isolada</summary>
          <p>{item.assignedTask}</p>
          {item.taskSliceVersion && (
            <small>{item.taskSliceVersion}</small>
          )}
        </details>
      )}

      {detail && <p className="agent-contract-detail">{detail}</p>}

      {(
        item.model ||
        item.tokenUsage ||
        item.retryCount ||
        item.latencyMs != null ||
        item.contractVersion
      ) && (
        <footer>
          {item.model && <span>{item.model}</span>}
          {item.tokenUsage?.total_tokens != null && (
            <span>
              {item.tokenUsage.total_tokens} tokens
            </span>
          )}
          {item.retryCount > 0 && (
            <span>{item.retryCount} retry</span>
          )}
          {item.latencyMs != null && (
            <span>{item.latencyMs} ms</span>
          )}
          {item.contractVersion && (
            <span>{item.contractVersion}</span>
          )}
          {item.budgetExceeded && (
            <span>budget excedido</span>
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
