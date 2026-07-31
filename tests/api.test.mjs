import test from "node:test";
import assert from "node:assert/strict";

import { createApiClient } from "../src/api/client.mjs";


function makeClient(capture) {
  return createApiClient({
    baseUrl: "http://api.local",
    getSession: () => ({
      tenantId: "tenant-a",
      userId: "user-a",
      role: "member",
    }),
    fetchImpl: async (url, options) => {
      capture.url = url;
      capture.options = options;
      return {
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json",
        },
        json: async () => [],
      };
    },
  });
}


test("sends tenant user and request headers", async () => {
  const capture = {};
  const client = makeClient(capture);
  await client.listAgents();
  assert.equal(
    capture.options.headers["X-Tenant-ID"],
    "tenant-a",
  );
  assert.equal(
    capture.options.headers["X-User-ID"],
    "user-a",
  );
  assert.match(
    capture.options.headers["X-Request-ID"],
    /^request_/,
  );
});


test("cancel execution uses terminal cancellation endpoint", async () => {
  const capture = {};
  const client = makeClient(capture);
  await client.cancelExecution(
    "request-cancel",
    "Operator requested cancellation.",
  );
  assert.equal(
    capture.url,
    "http://api.local/api/chat/executions/request-cancel/cancel",
  );
  assert.equal(capture.options.method, "POST");
  assert.deepEqual(
    JSON.parse(capture.options.body),
    {
      reason: "Operator requested cancellation.",
    },
  );
});


test("recovery decision uses governed endpoint", async () => {
  const capture = {};
  const client = makeClient(capture);
  await client.recordRecoveryDecision(
    "request-stale",
    "abandon",
    "Human review required.",
  );
  assert.equal(
    capture.url,
    "http://api.local/api/governance/executions/request-stale/recovery-decisions",
  );
  assert.deepEqual(
    JSON.parse(capture.options.body),
    {
      decision: "abandon",
      reason: "Human review required.",
    },
  );
});
