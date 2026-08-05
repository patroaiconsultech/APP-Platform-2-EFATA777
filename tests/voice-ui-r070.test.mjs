
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";


async function source(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}


test("voice UI is feature-gated and Orkio-only", async () => {
  const panel = await source(
    "../src/components/VoiceCallPanel.jsx",
  );
  const chat = await source(
    "../src/features/chat/ChatConsole.jsx",
  );
  assert.match(panel, /selectedAgentId === "Orkio"/);
  assert.match(panel, /interactionMode === "single"/);
  assert.match(
    chat,
    /governance\?\.realtime_voice_enabled === true/,
  );
  assert.match(panel, /Áudio realtime com transcrição/);
});


test("frontend contains no provider API key or direct OpenAI call", async () => {
  const voice = await source(
    "../src/voice/realtimeVoice.mjs",
  );
  const api = await source("../src/api/client.mjs");
  assert.doesNotMatch(voice, /api\.openai\.com/);
  assert.doesNotMatch(voice, /OPENAI_API_KEY/);
  assert.doesNotMatch(api, /OPENAI_API_KEY/);
  assert.match(api, /\/api\/voice\/sessions/);
});


test("voice transcript containers preserve bounded responsive layout", async () => {
  const css = await source("../src/index.css");
  assert.match(css, /\.voice-call-panel/);
  assert.match(css, /\.voice-transcript-turn[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.voice-call-panel/,
  );
});
