export function AdminPanel({overview}) {
  if (!overview) return null;
  return <section><h2>Admin · tenant</h2>
    <p>{overview.tenant_id}</p>
    <p>Threads: {overview.stats.threads}</p>
    <p>Mensagens: {overview.stats.messages}</p>
  </section>;
}
