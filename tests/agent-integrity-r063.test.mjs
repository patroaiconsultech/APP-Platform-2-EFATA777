import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeSSE,
  createTerminalState,
  reduceSSEEvent,
  summarizeTerminalEvidence,
} from "../src/realtime/sse.mjs";
import {
  parseRoundtableSections,
} from "../src/presentation/messageView.mjs";


function event(id, type, payload = {}) {
  return {
    id,
    event: type,
    data: {
      payload,
    },
  };
}


test("wire evidence uses locally observed event count and id", () => {
  let state = {
    ...createTerminalState(),
    transport: "sse",
  };
  state = reduceSSEEvent(
    state,
    event("execution:1", "agent_done", {
      agent_done_observed: true,
      message: {
        content: "Done",
      },
    }),
  );
  state = reduceSSEEvent(
    state,
    event("execution:2", "done", {
      outcome: "success",
      event_count: 999,
      last_event_id: "spoofed",
      terminal_source: "wire",
    }),
  );

  assert.equal(state.eventCount, 2);
  assert.equal(state.lastEventId, "execution:2");
  assert.equal(state.agentDoneObserved, true);
  assert.equal(state.doneObserved, true);
  assert.equal(state.terminalSource, "wire");
  assert.deepEqual(summarizeTerminalEvidence(state), {
    label: "agent_done + done",
    complete: true,
    warning: false,
  });
});


test("HTTP JSON envelope never claims SSE terminal events", () => {
  const state = {
    ...createTerminalState(),
    terminal: true,
    phase: "done",
    transport: "http_json",
    terminalSource: "envelope",
    eventCount: 0,
    agentDoneObserved: false,
    doneObserved: false,
  };

  assert.deepEqual(summarizeTerminalEvidence(state), {
    label: "envelope success",
    complete: true,
    warning: false,
  });
});


test("SSE without done is visibly incomplete", () => {
  const state = {
    ...createTerminalState(),
    terminal: true,
    transport: "sse",
    terminalSource: null,
    eventCount: 3,
    agentDoneObserved: true,
    doneObserved: false,
  };

  assert.deepEqual(summarizeTerminalEvidence(state), {
    label: "SSE sem done",
    complete: false,
    warning: true,
  });
});


test("invalid explicit content type is rejected", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type"
          ? "application/json"
          : null;
      },
    },
    text: async () => "{}",
  });

  await assert.rejects(
    consumeSSE({
      url: "https://api.example.test/api/chat/stream",
      payload: {
        request_id: "request-content-type",
        interaction_mode: "single",
      },
      session: {
        mode: "demo_headers",
        tenantId: "tenant-a",
        userId: "user-a",
      },
      fetchImpl,
    }),
    (error) => error.code === "SSE_CONTENT_TYPE_INVALID",
  );
});


test("contributor refusal remains refused in visible state", () => {
  let state = createTerminalState();
  state = reduceSSEEvent(
    state,
    event("execution:1", "agent_contribution_done", {
      node_id: "node-laura",
      agent_id: "Laura",
      display_name: "Laura",
      phase: "node_completed",
      status: "refused",
      status_reason: "generic_refusal",
      retry_count: 1,
      content: "Desculpe, não posso ajudar.",
    }),
  );

  assert.equal(state.contributors[0].status, "refused");
  assert.equal(
    state.contributors[0].statusReason,
    "generic_refusal",
  );
  assert.equal(state.contributors[0].retryCount, 1);
});


test("persisted roundtable headings accept role descriptors", () => {
  const sections = parseRoundtableSections(
    [
      "### ORION — ARQUITETURA E ENGENHARIA",
      "Visão técnica.",
      "",
      "### CHRIS - NEGÓCIO E ESTRATÉGIA",
      "Visão comercial.",
      "",
      "### LAURA: PRODUTO E UX",
      "Jornada.",
      "",
      "### ORKIO — COORDENAÇÃO",
      "Decisão.",
    ].join("\n"),
  );

  assert.deepEqual(
    sections.map((item) => item.agentId),
    ["Orion", "Chris", "Laura", "Orkio"],
  );
  assert.equal(sections[0].content, "Visão técnica.");
  assert.equal(sections[3].content, "Decisão.");
});


test("R0.6.5 evidence UI exposes truthful transport fields", async () => {
  const source = await import("node:fs/promises");
  const evidence = await source.readFile(
    new URL(
      "../src/components/ExecutionEvidenceBar.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const activity = await source.readFile(
    new URL(
      "../src/components/AgentActivityPanel.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const index = await source.readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );

  assert.match(evidence, /Transporte/);
  assert.match(evidence, /Eventos wire/);
  assert.match(evidence, /Fonte terminal/);
  assert.match(activity, /Bloqueado por contrato/);
  assert.match(activity, /Recusado/);
  assert.match(index, /Premium R0\.6\.5/);
});
