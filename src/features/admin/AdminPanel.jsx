import {
  formatMessageTimestamp,
} from "../../presentation/messageView.mjs";


function RuntimeRow({ label, value, active, warning }) {
  return (
    <div className="runtime-row">
      <span>{label}</span>
      <strong
        className={
          active
            ? "is-active"
            : warning
              ? "is-warning"
              : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}


function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}


export function AdminPanel({
  overview,
  governance,
  capabilities,
}) {
  if (!overview) return null;

  const runtime = overview.runtime ?? {};
  const gates = overview.governance ?? {};
  const summary = overview.capability_summary ?? {};
  const generatedAt = formatMessageTimestamp(
    overview.generated_at,
  );

  return (
    <aside className="admin-panel panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">ADMIN · TENANT ONLY</span>
          <h2>Audit Control Center</h2>
          {generatedAt && (
            <small>Snapshot: {generatedAt}</small>
          )}
        </div>
      </div>

      <div className="metric-grid premium-metrics">
        <MetricCard
          label="Threads"
          value={overview.stats?.threads}
        />
        <MetricCard
          label="Mensagens"
          value={overview.stats?.messages}
        />
        <MetricCard
          label="Execuções"
          value={overview.stats?.executions}
        />
        <MetricCard
          label="Decisões de recovery"
          value={overview.stats?.recovery_decisions}
        />
      </div>

      <div className="runtime-status-list">
        <RuntimeRow
          label="Release"
          value={
            runtime.release_version ??
            governance?.release_version ??
            "não identificada"
          }
          active
        />
        <RuntimeRow
          label="Commit"
          value={
            runtime.release_sha ??
            governance?.release_sha ??
            "UNPINNED"
          }
          warning={
            (runtime.release_sha ?? governance?.release_sha) ===
            "UNPINNED"
          }
        />
        <RuntimeRow
          label="Repository"
          value={
            runtime.repository_backend ??
            governance?.repository_backend ??
            "desconhecido"
          }
        />
        <RuntimeRow
          label="LLM"
          value={
            runtime.llm_model ??
            governance?.llm_model ??
            "não identificado"
          }
          active={
            runtime.real_llm_enabled ??
            governance?.real_llm_enabled
          }
        />
        <RuntimeRow
          label="Realtime textual"
          value={
            (runtime.realtime_streaming_enabled ??
              governance?.realtime_streaming_enabled)
              ? "ativo"
              : "inativo"
          }
          active={
            runtime.realtime_streaming_enabled ??
            governance?.realtime_streaming_enabled
          }
        />
        <RuntimeRow
          label="Multiagente"
          value={
            (runtime.multiagent_enabled ??
              governance?.multiagent_enabled)
              ? "ativo"
              : "inativo"
          }
          active={
            runtime.multiagent_enabled ??
            governance?.multiagent_enabled
          }
        />
        <RuntimeRow
          label="Execution graph"
          value={
            runtime.execution_graph ??
            governance?.execution_graph ??
            "desconhecido"
          }
          warning={
            (runtime.execution_graph ??
              governance?.execution_graph) === "trace_lite"
          }
        />
        <RuntimeRow
          label="WebRTC voz"
          value={runtime.voice_webrtc ?? "não implementado"}
          warning
        />
      </div>

      <div className="capability-summary">
        <h3>Capability Registry</h3>
        <div className="metric-grid capability-metrics">
          <MetricCard
            label="Disponíveis"
            value={summary.available}
          />
          <MetricCard
            label="Sob gate"
            value={summary.feature_gated}
          />
          <MetricCard
            label="Planejadas"
            value={summary.planned}
          />
          <MetricCard
            label="Total"
            value={
              summary.total ??
              capabilities?.length ??
              0
            }
          />
        </div>
      </div>

      <div className="runtime-status-list governance-gates">
        <h3>Gates de execução</h3>
        <RuntimeRow
          label="Write"
          value={gates.write_executed ? "executado" : "bloqueado"}
          active={!gates.write_executed}
        />
        <RuntimeRow
          label="Commit"
          value={gates.commit_executed ? "executado" : "bloqueado"}
          active={!gates.commit_executed}
        />
        <RuntimeRow
          label="Merge"
          value={gates.merge_executed ? "executado" : "bloqueado"}
          active={!gates.merge_executed}
        />
        <RuntimeRow
          label="Deploy"
          value={gates.deploy_executed ? "executado" : "bloqueado"}
          active={!gates.deploy_executed}
        />
        <RuntimeRow
          label="Aprovação humana"
          value={
            gates.human_approval_required === false
              ? "não exigida"
              : "obrigatória"
          }
          active={gates.human_approval_required !== false}
        />
      </div>

      <p className="admin-disclaimer">
        Este painel mostra somente evidências disponíveis no
        tenant atual. trace_lite não representa grafo persistente.
        Capacidades planejadas não estão disponíveis para execução.
      </p>
    </aside>
  );
}
