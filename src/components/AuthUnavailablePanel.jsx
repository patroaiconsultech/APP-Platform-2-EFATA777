export function AuthUnavailablePanel({
  authStatus,
  error,
  onRetry,
}) {
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <h1>ORKIO · Acesso indisponível</h1>
        <p>
          O console permanece bloqueado porque o contrato
          de autenticação não está disponível ou falhou de
          forma segura.
        </p>
        <dl>
          <dt>Modo</dt>
          <dd>
            {authStatus?.authMode ?? "indisponível"}
          </dd>
          <dt>Provedor</dt>
          <dd>
            {authStatus?.externalProviderConfigured
              ? "configurado"
              : "não configurado"}
          </dd>
        </dl>

        {error && (
          <div className="error-panel">
            {error.message ?? error.code}
          </div>
        )}

        <button type="button" onClick={onRetry}>
          Verificar novamente
        </button>
      </section>
    </main>
  );
}
