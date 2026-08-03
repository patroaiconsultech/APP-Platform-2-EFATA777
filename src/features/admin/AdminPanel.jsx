function RuntimeRow({ label, value, active }) {
  return (
    <div className="runtime-row">
      <span>{label}</span>
      <strong className={active ? "is-active" : ""}>
        {value}
      </strong>
    </div>
  );
}


export function AdminPanel({
  overview,
  governance,
  capabilities,
}) {
  if (!overview) return null;

  return (
    <aside className="admin-panel panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">ADMIN DEMO</span>
          <h2>Control Center</h2>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Tenant</span>
          <strong>{overview.tenant_id}</strong>
        </div>
        <div className="metric-card">
          <span>Threads</span>
          <strong>{overview.stats.threads}</strong>
        </div>
        <div className="metric-card">
          <span>Mensagens</span>
          <strong>{overview.stats.messages}</strong>
        </div>
      </div>

      <div className="runtime-status-list">
        <RuntimeRow
          label="LLM"
          value={governance?.llm_model ?? "não identificado"}
          active={governance?.real_llm_enabled}
        />
        <RuntimeRow
          label="Realtime textual"
          value={
            governance?.realtime_streaming_enabled
              ? "ativo"
              : "inativo"
          }
          active={governance?.realtime_streaming_enabled}
        />
        <RuntimeRow
          label="Multiagente"
          value={
            governance?.multiagent_enabled
              ? "ativo"
              : "inativo"
          }
          active={governance?.multiagent_enabled}
        />
        <RuntimeRow
          label="Execution graph"
          value={governance?.execution_graph ?? "desconhecido"}
        />
        <RuntimeRow
          label="Capabilities"
          value={String(
            capabilities?.length ??
            governance?.capability_registry_entries ??
            0,
          )}
        />
      </div>

      <p className="admin-disclaimer">
        trace_lite não representa grafo persistente. Ações
        críticas continuam exigindo aprovação humana.
      </p>
    </aside>
  );
}
