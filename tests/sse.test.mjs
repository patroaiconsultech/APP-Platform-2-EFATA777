import test from "node:test";
import assert from "node:assert/strict";

import {
  consumeSSE,
  createTerminalState,
  reduceSSEEvent,
} from "../src/realtime/sse.mjs";


function responseFromChunks(chunks) {
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return {
                done: true,
                value: undefined,
              };
            }
            return {
              done: false,
              value: new TextEncoder().encode(
                chunks[index++],
              ),
            };
          },
        };
      },
    },
  };
}


test("incremental success requires agent_done and done", async () => {
  const state = await consumeSSE({
    url: "http://api.local/api/chat/stream",
    payload: {
      request_id: "r1",
    },
    session: {
      tenantId: "tenant-a",
      userId: "user-a",
      role: "member",
    },
    fetchImpl: async () =>
      responseFromChunks([
        'id: e0\nevent: execution\ndata: {"payload":{"request_id":"r1","execution_id":"x1"}}\n\n',
        'id: e1\nevent: agent_chunk\ndata: {"payload":{"content":"A"}}\n\n',
        'id: e2\nevent: agent_done\ndata: {"payload":{"message":{"message_id":"m1"}}}\n\n',
        'id: e3\nevent: done\ndata: {"payload":{"outcome":"success"}}\n\n',
      ]),
  });
  assert.equal(state.content, "A");
  assert.equal(state.agentDone, true);
  assert.equal(state.terminal, true);
  assert.equal(state.requestId, "r1");
  assert.equal(state.executionId, "x1");
});


test("cancelled plus done is a valid terminal flow", async () => {
  const state = await consumeSSE({
    url: "http://api.local/api/chat/stream",
    payload: {
      request_id: "r-cancel",
    },
    session: {
      tenantId: "tenant-a",
      userId: "user-a",
      role: "member",
    },
    fetchImpl: async () =>
      responseFromChunks([
        'id: e0\nevent: execution\ndata: {"payload":{"request_id":"r-cancel","execution_id":"x-cancel"}}\n\n',
        'id: e1\nevent: cancelled\ndata: {"payload":{"message":{"message_id":"m-cancel","status":"cancelled"}}}\n\n',
        'id: e2\nevent: done\ndata: {"payload":{"outcome":"cancelled"}}\n\n',
      ]),
  });
  assert.equal(state.cancelled, true);
  assert.equal(state.phase, "cancelled");
  assert.equal(state.terminal, true);
  assert.equal(
    state.assistantMessage.message_id,
    "m-cancel",
  );
});


test("done without agent_done fails closed", async () => {
  await assert.rejects(
    () =>
      consumeSSE({
        url: "http://api.local/api/chat/stream",
        payload: {
          request_id: "r1",
        },
        session: {
          tenantId: "tenant-a",
          userId: "user-a",
          role: "member",
        },
        fetchImpl: async () =>
          responseFromChunks([
            'id: e1\nevent: done\ndata: {"payload":{"outcome":"success"}}\n\n',
          ]),
      }),
    /SSE_AGENT_DONE_MISSING/,
  );
});


test("event after done fails closed", () => {
  const state = reduceSSEEvent(
    createTerminalState(),
    {
      id: "e1",
      event: "done",
      data: {
        payload: {
          outcome: "success",
        },
      },
    },
  );
  assert.throws(
    () =>
      reduceSSEEvent(state, {
        id: "e2",
        event: "agent_chunk",
        data: {
          payload: {
            content: "late",
          },
        },
      }),
    /SSE_EVENT_AFTER_DONE/,
  );
});
