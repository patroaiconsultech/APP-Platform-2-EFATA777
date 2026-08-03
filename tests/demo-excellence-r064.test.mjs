import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  createTerminalState,
  reduceSSEEvent,
  summarizeTerminalEvidence,
} from "../src/realtime/sse.mjs";


function event(id, type, payload = {}) {
  return {
    id,
    event: type,
    data: { payload },
  };
}


test("partial SSE preserves contributors and terminates with partial plus done", () => {
  let state = {
    ...createTerminalState(),
    transport: "sse",
  };

  state = reduceSSEEvent(
    state,
    event("execution:1", "agent_contribution_done", {
      node_id: "node-orion",
      agent_id: "Orion",
      display_name: "Orion",
      status: "success",
      content: "Contribuição técnica.",
      assigned_task: "Avaliar riscos técnicos.",
      task_slice_version: "task_slice_v1",
      explicit_assignment: true,
    }),
  );
  state = reduceSSEEvent(
    state,
    event("execution:2", "partial", {
      reason: "OWNER_CONTRACT_PARTIAL",
      message: {
        status: "partial",
        contributions: [
          {
            agent_id: "Orion",
            display_name: "Orion",
            status: "success",
            content: "Contribuição técnica.",
            assigned_task: "Avaliar riscos técnicos.",
            task_slice_version: "task_slice_v1",
            explicit_assignment: true,
          },
        ],
        owner_contract: {
          status: "partial",
          owner_contract: "decision_v1",
          contract_version: "owner_decision_v4",
          retry_count: 1,
          retry_scope: "owner_only",
          contributors_preserved: true,
        },
      },
    }),
  );
  state = reduceSSEEvent(
    state,
    event("execution:3", "done", {
      outcome: "partial",
    }),
  );

  assert.equal(state.partial, true);
  assert.equal(state.phase, "partial");
  assert.equal(state.partialReason, "OWNER_CONTRACT_PARTIAL");
  assert.equal(state.contributors.length, 1);
  assert.equal(
    state.contributors[0].assignedTask,
    "Avaliar riscos técnicos.",
  );
  assert.equal(state.ownerContract.retryScope, undefined);
  assert.equal(state.ownerContract.retry_scope, "owner_only");
  assert.equal(state.eventCount, 3);
  assert.equal(state.lastEventId, "execution:3");
  assert.equal(state.doneObserved, true);
  assert.equal(state.terminalSource, "wire");
  assert.deepEqual(summarizeTerminalEvidence(state), {
    label: "partial + done",
    complete: true,
    warning: true,
  });
});


test("HTTP JSON partial never claims wire events", () => {
  const state = {
    ...createTerminalState(),
    phase: "partial",
    terminal: true,
    partial: true,
    transport: "http_json",
    terminalSource: "envelope",
    eventCount: 0,
    doneObserved: false,
    agentDoneObserved: false,
  };

  assert.deepEqual(summarizeTerminalEvidence(state), {
    label: "envelope partial",
    complete: true,
    warning: false,
  });
});


test("agent selector is fixed in sidebar and absent from chat toolbar", async () => {
  const sidebar = await readFile(
    new URL(
      "../src/components/ThreadSidebar.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const chat = await readFile(
    new URL(
      "../src/features/chat/ChatConsole.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const css = await readFile(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(sidebar, /sidebar-agent-controls/);
  assert.match(sidebar, /<AgentPicker/);
  assert.match(sidebar, /<InteractionModePicker/);
  assert.doesNotMatch(chat, /<AgentPicker/);
  assert.doesNotMatch(chat, /<InteractionModePicker/);
  assert.match(css, /\.sidebar-agent-controls/);
  assert.match(css, /position:\s*sticky/);
});


test("thread rename and partial UX are visible and actionable", async () => {
  const sidebar = await readFile(
    new URL(
      "../src/components/ThreadSidebar.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const chat = await readFile(
    new URL(
      "../src/features/chat/ChatConsole.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const app = await readFile(
    new URL("../src/App.jsx", import.meta.url),
    "utf8",
  );

  assert.match(sidebar, /Renomear conversa/);
  assert.match(sidebar, /onRename/);
  assert.match(chat, /Síntese parcial/);
  assert.match(chat, /contribuições validadas foram preservadas/i);
  assert.match(app, /Premium Demo Excellence/);
  assert.match(app, /R0\.6\.4/);
});


test("execution evidence exposes adaptive owner contract", async () => {
  const evidence = await readFile(
    new URL(
      "../src/components/ExecutionEvidenceBar.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const activity = await readFile(
    new URL(
      "../src/components/AgentActivityPanel.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(evidence, /Contrato owner/);
  assert.match(evidence, /Contrato runtime/);
  assert.match(evidence, /Retry owner/);
  assert.match(activity, /Tarefa isolada/);
  assert.match(activity, /assignedTask/);
});
