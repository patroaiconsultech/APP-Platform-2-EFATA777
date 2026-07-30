import test from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "../src/api/client.mjs";

test("api client sends tenant and user headers", async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      headers: {
        get: () => "application/json",
      },
      json: async () => [],
    };
  };

  const client = createApiClient({
    baseUrl: "http://api.local",
    getSession: () => ({
      tenantId: "tenant-a",
      userId: "user-a",
      role: "member",
    }),
    fetchImpl,
  });
  await client.listAgents();

  assert.equal(captured.options.headers["X-Tenant-ID"], "tenant-a");
  assert.equal(captured.options.headers["X-User-ID"], "user-a");
});

test("api client fails without session", async () => {
  const client = createApiClient({
    baseUrl: "http://api.local",
    getSession: () => null,
    fetchImpl: async () => {
      throw new Error("must not call fetch");
    },
  });

  await assert.rejects(
    () => client.listAgents(),
    (error) => error.code === "AUTH_CONTEXT_REQUIRED",
  );
});
