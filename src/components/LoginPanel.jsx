export function LoginPanel({
  authStatus,
  authError,
  onDemoLogin,
  onOidcLogin,
}) {
  if (authStatus?.authMode === "oidc_introspection") {
    return (
      <main className="auth-gate">
        <section className="auth-card">
          <div className="brand-mark">O</div>
          <h1>ORKIO · Acesso corporativo</h1>
          <p>
            Entre pelo provedor de identidade configurado.
            A ORKIO receberá apenas um token de acesso
            temporário e resolverá tenant e papel no backend.
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

  const profile = authStatus?.demoProfile;
  if (!profile) {
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
      <section className="auth-card">
        <h1>ORKIO RC1 · Acesso controlado</h1>
        <p>
          Identidade sintética permitida somente em
          ambiente RC1 isolado e sem dados reais.
        </p>
        <dl>
          <dt>Tenant</dt>
          <dd>{profile.tenantId}</dd>
          <dt>Usuário</dt>
          <dd>{profile.userId}</dd>
        </dl>

        {authError && (
          <div className="error-panel">
            {authError.message ?? authError.code}
          </div>
        )}

        <button
          type="button"
          className="primary-action"
          onClick={() =>
            onDemoLogin({
              mode: "demo_headers",
              tenantId: profile.tenantId,
              userId: profile.userId,
              role: "member",
            })
          }
        >
          Entrar no ambiente RC1
        </button>
      </section>
    </main>
  );
}
