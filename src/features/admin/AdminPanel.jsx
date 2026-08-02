export function AdminPanel({ overview }) {
  if (!overview) return null;

  return (
    <section className="admin-panel panel">
      <h2>Visão administrativa</h2>

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
    </section>
  );
}
