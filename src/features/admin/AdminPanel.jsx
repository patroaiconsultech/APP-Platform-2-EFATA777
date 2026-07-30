export function AdminPanel({ overview }) {
  if (!overview) return null;
  return (
    <section className="admin-panel">
      <span className="eyebrow">ADMIN · TENANT ONLY</span>
      <h2>Visão operacional</h2>
      <dl>
        <div>
          <dt>Tenant</dt>
          <dd>{overview.tenant_id}</dd>
        </div>
        <div>
          <dt>Threads</dt>
          <dd>{overview.stats.threads}</dd>
        </div>
        <div>
          <dt>Mensagens</dt>
          <dd>{overview.stats.messages}</dd>
        </div>
      </dl>
    </section>
  );
}
