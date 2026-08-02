import test from "node:test";
import assert from "node:assert/strict";

import {
  ApiError,
  createApiClient,
} from "../src/api/client.mjs";


function jsonResponse({
  status = 200,
  body = {},
}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => "application/json",
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}


test("auth status is public without identity", async () => {
  const capture = {};
  const client = createApiClient({
    baseUrl: "http://api.local",
    getSession: () => null,
    fetchImpl: async (url, options) => {
      capture.url = url;
      capture.options = options;
      return jsonResponse({
        body: {
          auth_mode: "external_required",
        },
      });
    },
  });

  await client.authStatus();

  assert.equal(
    capture.url,
    "http://api.local/api/auth/status",
  );
  assert.equal(
    capture.options.headers.Authorization,
    undefined,
  );
  assert.equal(
    capture.options.headers["X-Tenant-ID"],
    undefined,
  );
});


test("OIDC protected call sends bearer only", async () => {
  const capture = {};
  const client = createApiClient({
    baseUrl: "http://api.local",
    getSession: () => ({
      mode: "oidc_introspection",
      accessToken: "verified-later",
      expiresAt: Date.now() + 60_000,
    }),
    fetchImpl: async (url, options) => {
      capture.url = url;
      capture.options = options;
      return jsonResponse({ body: [] });
    },
  });

  await client.listAgents();

  assert.equal(
    capture.options.headers.Authorization,
    "Bearer verified-later",
  );
  assert.equal(
    capture.options.headers["X-Tenant-ID"],
    undefined,
  );
  assert.equal(
    capture.options.headers["X-Role"],
    undefined,
  );
});


test("demo protected call sends controlled headers", async () => {
  const capture = {};
  const client = createApiClient({
    baseUrl: "http://api.local",
    getSession: () => ({
      mode: "demo_headers",
      tenantId: "tenant-demo",
      userId: "user-demo",
      role: "member",
    }),
    fetchImpl: async (url, options) => {
      capture.options = options;
      return jsonResponse({ body: [] });
    },
  });

  await client.listThreads();

  assert.equal(
    capture.options.headers["X-Tenant-ID"],
    "tenant-demo",
  );
  assert.equal(
    capture.options.headers.Authorization,
    undefined,
  );
});


test("protected call without session fails before fetch", async () => {
  let fetchCalled = false;
  let authFailure = null;

  const client = createApiClient({
    baseUrl: "http://api.local",
    getSession: () => null,
    fetchImpl: async () => {
      fetchCalled = true;
      return jsonResponse({});
    },
    onAuthFailure: (error) => {
      authFailure = error;
    },
  });

  await assert.rejects(
    () => client.listAgents(),
    (error) =>
      error instanceof ApiError &&
      error.code === "AUTH_CONTEXT_REQUIRED",
  );

  assert.equal(fetchCalled, false);
  assert.equal(
    authFailure.code,
    "AUTH_CONTEXT_REQUIRED",
  );
});


test("ordinary admin authorization does not clear session", async () => {
  let authFailure = null;

  const client = createApiClient({
    baseUrl: "http://api.local",
    getSession: () => ({
      mode: "oidc_introspection",
      accessToken: "token",
      expiresAt: Date.now() + 60_000,
    }),
    fetchImpl: async () =>
      jsonResponse({
        status: 403,
        body: {
          detail: {
            code: "ADMIN_ROLE_REQUIRED",
            message: "Administrator role is required.",
          },
        },
      }),
    onAuthFailure: (error) => {
      authFailure = error;
    },
  });

  await assert.rejects(
    () => client.adminOverview(),
    /Administrator role is required/,
  );
  assert.equal(authFailure, null);
});
