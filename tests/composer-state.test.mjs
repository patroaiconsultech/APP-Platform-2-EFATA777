import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveComposerState,
} from "../src/features/chat/composerState.mjs";


test("no thread shows create-conversation state", () => {
  assert.deepEqual(
    resolveComposerState({
      hasActiveThread: false,
      phase: "idle",
      content: "hello",
    }),
    {
      disabled: true,
      canSend: false,
      label: "Crie uma conversa",
      placeholder:
        "Crie ou selecione uma conversa para começar.",
    },
  );
});


test("active stream shows transmitting state", () => {
  const state = resolveComposerState({
    hasActiveThread: true,
    phase: "streaming",
    content: "hello",
  });
  assert.equal(state.disabled, true);
  assert.equal(state.label, "Transmitindo…");
});


test("active thread with text can send", () => {
  const state = resolveComposerState({
    hasActiveThread: true,
    phase: "idle",
    content: "  hello  ",
  });
  assert.equal(state.disabled, false);
  assert.equal(state.canSend, true);
  assert.equal(state.label, "Enviar");
});
