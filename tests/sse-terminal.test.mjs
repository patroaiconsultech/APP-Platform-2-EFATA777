import test from "node:test";
import assert from "node:assert/strict";

import {
  consumeSSE,
} from "../src/realtime/sse.mjs";


function responseFrom(text) {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(text)];
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    }),
  };
}


const session = {
  mode: "oidc_introspection",
  accessToken: "token",
  expiresAt: Date.now() + 60_000,
};


test("stream requires terminal done", async () => {
  await assert.rejects(
    () =>
      consumeSSE({
        url: "https://api.example/stream",
        payload: {
          request_id: "request-1",
        },
        session,
        fetchImpl: async () =>
          responseFrom(
            'event: delta\ndata: {"delta":"hello"}\n\n',
          ),
      }),
    /terminal done/,
  );
});


test("agent_done followed by done succeeds", async () => {
  const states = [];
  const result = await consumeSSE({
    url: "https://api.example/stream",
    payload: {
      request_id: "request-2",
    },
    session,
    onState: (state) => states.push(state),
    fetchImpl: async () =>
      responseFrom(
        'event: delta\ndata: {"delta":"hello"}\n\n' +
        'event: agent_done\ndata: {"message":{"content":"hello"}}\n\n' +
        'event: done\ndata: {"ok":true}\n\n',
      ),
  });

  assert.equal(result.terminal, true);
  assert.equal(result.content, "hello");
  assert.equal(result.phase, "done");
  assert.ok(
    states.some((state) => state.terminal),
  );
});
