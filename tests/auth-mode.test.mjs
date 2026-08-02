import test from "node:test";
import assert from "node:assert/strict";

import {
  isAuthFailure,
  normalizeAuthStatus,
  sessionMatchesAuthStatus,
} from "../src/auth/mode.mjs";


test("normalizes demo auth status and profile", () => {
  const status = normalizeAuthStatus({
    auth_mode: "demo_headers",
    demo_available: true,
    demo_admin_enabled: false,
    demo_profile: {
      tenant_id: "tenant-demo",
      user_id: "user-demo",
      role: "member",
    },
    external_provider_configured: false,
  });

  assert.equal(status.authMode, "demo_headers");
  assert.deepEqual(status.demoProfile, {
    tenantId: "tenant-demo",
    userId: "user-demo",
    role: "member",
  });
});


test("normalizes OIDC public configuration", () => {
  const status = normalizeAuthStatus({
    auth_mode: "oidc_introspection",
    external_provider_configured: true,
    oidc: {
      issuer: "https://issuer.example/",
      authorization_endpoint:
        "https://issuer.example/authorize",
      token_endpoint:
        "https://issuer.example/token",
      client_id: "orkio-spa",
      redirect_uri:
        "https://app.example/auth/callback",
      scopes: ["openid", "profile"],
    },
  });

  assert.equal(
    status.authMode,
    "oidc_introspection",
  );
  assert.equal(
    status.oidc.issuer,
    "https://issuer.example",
  );
  assert.equal(status.oidc.clientId, "orkio-spa");
});


test("demo session must match backend profile", () => {
  const status = normalizeAuthStatus({
    auth_mode: "demo_headers",
    demo_available: true,
    demo_admin_enabled: false,
    demo_profile: {
      tenant_id: "tenant-demo",
      user_id: "user-demo",
      role: "member",
    },
  });

  assert.equal(
    sessionMatchesAuthStatus(
      {
        mode: "demo_headers",
        tenantId: "tenant-demo",
        userId: "user-demo",
        role: "member",
      },
      status,
    ),
    true,
  );
  assert.equal(
    sessionMatchesAuthStatus(
      {
        mode: "demo_headers",
        tenantId: "another-tenant",
        userId: "user-demo",
        role: "member",
      },
      status,
    ),
    false,
  );
});


test("OIDC session requires non-expired token", () => {
  const status = normalizeAuthStatus({
    auth_mode: "oidc_introspection",
    external_provider_configured: true,
    oidc: {
      issuer: "https://issuer.example",
      authorization_endpoint:
        "https://issuer.example/authorize",
      token_endpoint:
        "https://issuer.example/token",
      client_id: "orkio-spa",
      redirect_uri:
        "https://app.example/auth/callback",
      scopes: ["openid"],
    },
  });

  assert.equal(
    sessionMatchesAuthStatus(
      {
        mode: "oidc_introspection",
        accessToken: "token",
        expiresAt: 100_000,
      },
      status,
      10_000,
    ),
    true,
  );
  assert.equal(
    sessionMatchesAuthStatus(
      {
        mode: "oidc_introspection",
        accessToken: "token",
        expiresAt: 12_000,
      },
      status,
      10_000,
    ),
    false,
  );
});


test("ordinary authorization failure is not logout", () => {
  assert.equal(
    isAuthFailure({
      status: 401,
      code: "AUTH_TOKEN_EXPIRED",
    }),
    true,
  );
  assert.equal(
    isAuthFailure({
      status: 403,
      code: "ADMIN_ROLE_REQUIRED",
    }),
    false,
  );
});
