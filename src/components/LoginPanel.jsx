import { useState } from "react";

export function LoginPanel({ onLogin }) {
  const [tenantId, setTenantId] = useState("tenant-demo");
  const [userId, setUserId] = useState("user-demo");
  const [role, setRole] = useState("member");

  function submit(event) {
    event.preventDefault();
    onLogin({ tenantId, userId, role });
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">ORKIO · RC0 SANDBOX</span>
        <h1>Plataforma 2.0</h1>
        <p>
          Identidade por headers existe somente para dry-run local.
          Produção exige autenticação real no backend.
        </p>
        <label>
          Tenant
          <input
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            required
          />
        </label>
        <label>
          Usuário
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            required
          />
        </label>
        <label>
          Papel
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="member">Membro</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <button type="submit">Entrar no sandbox</button>
      </form>
    </main>
  );
}
