export function LoginPanel({
  authStatus,
  authError,
  onDemoLogin,
  onOidcLogin,
}) {
  if (authStatus?.authMode === "oidc_introspection") {
    return (
      <main className="auth-gate">
        <section className="auth-card premium-auth-card">
          <div className="brand-mark brand-orbit">O</div>
          <p className="eyebrow">ORKIO PLATFORM</p>
          <h1>Acesso corporativo</h1>
          <p>
            Entre pelo provedor configurado. Tenant e papel
            serão resolvidos e validados pelo backend.
          </p>

          {authError && (
            <div className="error-panel">
              {authError.message ?? authError.code}
            </div>
          )}

          <button
            type="button"
            className="primary-action"
            onClick={onOidcLogin}
          >
            Entrar com identidade corporativa
          </button>
        </section>
      </main>
    );
  }

  const memberProfile = authStatus?.demoProfile;
  const adminProfile = authStatus?.demoAdminProfile;
  if (!memberProfile) {
    return (
      <main className="auth-gate">
        <section className="auth-card">
          <div className="error-panel">
            O perfil de acesso não está disponível.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-gate">
      <section className="auth-card premium-auth-card">
        <div className="brand-mark brand-orbit">O</div>
        <p className="eyebrow">DEMONSTRAÇÃO CONTROLADA</p>
        <h1>ORKIO Command Center</h1>
        <p>
          Ambiente RC1 com identidade sintética, agentes,
          realtime textual e governança assistida.
        </p>

        {authError && (
          <div className="error-panel">
            {authError.message ?? authError.code}
          </div>
        )}

        <div className="login-profile-grid">
          <article className="login-profile-card">
            <span className="profile-kicker">OPERAÇÃO</span>
            <strong>{memberProfile.userId}</strong>
            <small>{memberProfile.tenantId}</small>
            <button
              type="button"
              className="primary-action"
              onClick={() =>
                onDemoLogin({
                  mode: "demo_headers",
                  tenantId: memberProfile.tenantId,
                  userId: memberProfile.userId,
                  role: "member",
                })
              }
            >
              Entrar como membro
            </button>
          </article>

          {adminProfile && (
            <article className="login-profile-card admin-profile-card">
              <span className="profile-kicker">ADMIN DEMO</span>
              <strong>{adminProfile.userId}</strong>
              <small>{adminProfile.tenantId}</small>
              <button
                type="button"
                className="secondary-action"
                onClick={() =>
                  onDemoLogin({
                    mode: "demo_headers",
                    tenantId: adminProfile.tenantId,
                    userId: adminProfile.userId,
                    role: "admin",
                  })
                }
              >
                Entrar no Control Center
              </button>
            </article>
          )}
        </div>

        <p className="security-note">
          Não utilize esta modalidade com tenants ou dados reais.
        </p>
      </section>
    </main>
  );
}
