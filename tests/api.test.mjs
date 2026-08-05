import test from "node:test";
import assert from "node:assert/strict";

import { createApiClient } from "../src/api/client.mjs";


function makeClient(capture) {
  return createApiClient({
    baseUrl: "http://api.local",
    getSession: () => ({
      mode: "demo_headers",
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


test("rename thread uses tenant-scoped PATCH endpoint", async () => {
  const capture = {};
  const client = makeClient(capture);
  await client.renameThread(
    "thread-alpha",
    "Auditoria UX R0.6.4",
  );
  assert.equal(
    capture.url,
    "http://api.local/api/threads/thread-alpha",
  );
  assert.equal(capture.options.method, "PATCH");
  assert.deepEqual(
    JSON.parse(capture.options.body),
    {
      title: "Auditoria UX R0.6.4",
    },
  );
});


test("voice session API remains tenant-authenticated and canonical", async () => {
  const capture = {};
  const client = makeClient(capture);
  await client.createVoiceSession({
    thread_id: "thread-voice",
    requested_agent: "Orkio",
    interaction_mode: "single",
    consent_granted: true,
  });
  assert.equal(
    capture.url,
    "http://api.local/api/voice/sessions",
  );
  assert.equal(capture.options.method, "POST");
  assert.equal(
    capture.options.headers["X-Tenant-ID"],
    "tenant-a",
  );
  assert.deepEqual(
    JSON.parse(capture.options.body),
    {
      thread_id: "thread-voice",
      requested_agent: "Orkio",
      interaction_mode: "single",
      consent_granted: true,
    },
  );
});


test("voice call SDP is sent only to the backend route", async () => {
  const capture = {};
  const client = makeClient(capture);
  await client.createVoiceCall("voice_session_1", {
    sdp: "v=0\\r\\noffer",
    source_connection_id: "connection_1",
    expected_session_generation: 1,
  });
  assert.equal(
    capture.url,
    "http://api.local/api/voice/sessions/voice_session_1/calls",
  );
  assert.equal(
    capture.options.headers.Authorization,
    undefined,
  );
  assert.equal(capture.options.method, "POST");
});


test("voice close proves microphone and player release", async () => {
  const capture = {};
  const client = makeClient(capture);
  await client.closeVoiceSession(
    "voice_session_1",
    {
      close_reason: "user_end",
      microphone_released: true,
      player_released: true,
      expected_session_generation: 1,
    },
  );
  assert.deepEqual(
    JSON.parse(capture.options.body),
    {
      close_reason: "user_end",
      microphone_released: true,
      player_released: true,
      expected_session_generation: 1,
    },
  );
});
