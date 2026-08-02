const AUTH_MODES = new Set([
  "demo_headers",
  "oidc_introspection",
  "external_required",
]);

const AUTH_FAILURE_CODES = new Set([
  "AUTH_PROVIDER_REQUIRED",
  "AUTH_PROVIDER_NOT_CONFIGURED",
  "AUTH_TOKEN_REQUIRED",
  "AUTH_TOKEN_INVALID",
  "AUTH_TOKEN_INACTIVE",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_TOKEN_ISSUER_INVALID",
  "AUTH_TOKEN_AUDIENCE_INVALID",
  "AUTH_CONTEXT_REQUIRED",
  "AUTH_CONTEXT_INVALID",
  "AUTH_CONTEXT_CONFLICT",
  "AUTH_MEMBERSHIP_CLAIMS_REQUIRED",
  "DEMO_ADMIN_DISABLED",
]);


function normalizeOidc(raw) {
  if (!raw) return null;
  const config = {
    issuer: String(raw.issuer ?? "").replace(/\/+$/, ""),
    authorizationEndpoint:
      String(raw.authorization_endpoint ?? ""),
    tokenEndpoint: String(raw.token_endpoint ?? ""),
    clientId: String(raw.client_id ?? ""),
    redirectUri: String(raw.redirect_uri ?? ""),
    scopes: Array.isArray(raw.scopes)
      ? raw.scopes.map(String).filter(Boolean)
      : [],
  };

  if (
    !config.issuer ||
    !config.authorizationEndpoint ||
    !config.tokenEndpoint ||
    !config.clientId ||
    !config.redirectUri ||
    config.scopes.length === 0
  ) {
    throw new Error("OIDC_PUBLIC_CONFIG_INVALID");
  }
  return config;
}


export function normalizeAuthStatus(raw) {
  const authMode = raw?.auth_mode;
  if (!AUTH_MODES.has(authMode)) {
    throw new Error("AUTH_MODE_INVALID");
  }

  const demoProfile =
    authMode === "demo_headers"
      ? raw?.demo_profile
      : null;

  if (
    authMode === "demo_headers" &&
    (
      !demoProfile?.tenant_id ||
      !demoProfile?.user_id ||
      !demoProfile?.role
    )
  ) {
    throw new Error("DEMO_PROFILE_INVALID");
  }

  const oidc =
    authMode === "oidc_introspection"
      ? normalizeOidc(raw?.oidc)
      : null;

  return {
    candidate: raw.candidate ?? null,
    authMode,
    demoAvailable:
      authMode === "demo_headers" &&
      raw.demo_available === true,
    demoAdminEnabled:
      authMode === "demo_headers" &&
      raw.demo_admin_enabled === true,
    demoProfile:
      demoProfile
        ? {
            tenantId: String(demoProfile.tenant_id),
            userId: String(demoProfile.user_id),
            role:
              demoProfile.role === "admin"
                ? "admin"
                : "member",
          }
        : null,
    externalProviderConfigured:
      raw.external_provider_configured === true,
    oidc,
  };
}


export function isAuthFailure(error) {
  return (
    error?.status === 401 ||
    AUTH_FAILURE_CODES.has(error?.code)
  );
}


export function sessionMatchesAuthStatus(
  session,
  authStatus,
  now = Date.now(),
) {
  if (!session || !authStatus) return false;

  if (authStatus.authMode === "demo_headers") {
    if (session.mode !== "demo_headers") return false;
    const profile = authStatus.demoProfile;
    if (!profile) return false;
    return (
      session.tenantId === profile.tenantId &&
      session.userId === profile.userId &&
      (
        session.role === "member" ||
        (
          session.role === "admin" &&
          authStatus.demoAdminEnabled
        )
      )
    );
  }

  if (authStatus.authMode === "oidc_introspection") {
    return (
      session.mode === "oidc_introspection" &&
      typeof session.accessToken === "string" &&
      session.accessToken.length > 0 &&
      Number(session.expiresAt) > now + 5_000
    );
  }

  return false;
}
