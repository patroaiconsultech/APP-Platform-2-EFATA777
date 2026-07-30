import test from "node:test";
import assert from "node:assert/strict";
import {
  createTerminalState,
  parseSSEText,
  reduceSSEEvent,
} from "../src/realtime/sse.mjs";

function event(id, type, payload) {
  return {
    id,
    event: type,
    data: {
      payload,
    },
  };
}

test("parses SSE blocks", () => {
  const events = parseSSEText(
    'id: e1\nevent: agent_chunk\ndata: {"payload":{"content":"A"}}\n\n' +
    'id: e2\nevent: done\ndata: {"payload":{"outcome":"success"}}\n\n',
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].event, "agent_chunk");
  assert.equal(events[1].event, "done");
});

test("success stream becomes terminal", () => {
  let state = createTerminalState();
  state = reduceSSEEvent(state, event("e1", "agent_chunk", { content: "A" }));
  state = reduceSSEEvent(state, event("e2", "done", { outcome: "success" }));
  assert.equal(state.content, "A");
  assert.equal(state.terminal, true);
  assert.equal(state.phase, "done");
});

test("error plus done becomes terminal error", () => {
  let state = createTerminalState();
  state = reduceSSEEvent(
    state,
    event("e1", "error", { code: "SSE_GENERATOR_EXCEPTION" }),
  );
  state = reduceSSEEvent(
    state,
    event("e2", "done", { outcome: "error" }),
  );
  assert.equal(state.terminal, true);
  assert.equal(state.phase, "error");
  assert.equal(state.error.code, "SSE_GENERATOR_EXCEPTION");
});

test("event after done fails closed", () => {
  let state = reduceSSEEvent(
    createTerminalState(),
    event("e1", "done", { outcome: "success" }),
  );
  assert.throws(
    () => reduceSSEEvent(state, event("e2", "agent_chunk", { content: "late" })),
    /SSE_EVENT_AFTER_DONE/,
  );
});
