import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatMessageTimestamp,
  parseRoundtableSections,
  shouldSuggestRoundtable,
} from "../src/presentation/messageView.mjs";


test("formats canonical message date and time", () => {
  const formatted = formatMessageTimestamp(
    "2026-08-03T14:09:11Z",
    { timeZone: "UTC" },
  );
  assert.equal(formatted, "03/08/2026 · 14:09");
});


test("parses persisted roundtable into safe speaker sections", () => {
  const sections = parseRoundtableSections(
    "### Orion\nTechnical\n\n" +
      "### Chris\nStrategy\n\n" +
      "### Laura\nExperience\n\n" +
      "### Orkio\nDecision",
  );

  assert.deepEqual(
    sections.map((item) => item.agentId),
    ["Orion", "Chris", "Laura", "Orkio"],
  );
  assert.equal(sections[3].content, "Decision");
});


test("does not convert ordinary markdown into a roundtable", () => {
  assert.deepEqual(
    parseRoundtableSections(
      "### Conclusão\nUma resposta normal.",
    ),
    [],
  );
});


test("suggests roundtable explicitly without hidden mode switching", () => {
  assert.equal(
    shouldSuggestRoundtable({
      content: "Cada agente responda individualmente.",
      selectedAgentId: "Team",
      interactionMode: "team_synthesis",
    }),
    true,
  );
  assert.equal(
    shouldSuggestRoundtable({
      content: "Cada agente responda individualmente.",
      selectedAgentId: "Orion",
      interactionMode: "single",
    }),
    false,
  );
});


test("premium source exposes evidence and capability surfaces", async () => {
  const chat = await readFile(
    new URL(
      "../src/features/chat/ChatConsole.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const admin = await readFile(
    new URL(
      "../src/features/admin/AdminPanel.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(chat, /ExecutionEvidenceBar/);
  assert.match(chat, /CapabilityProofPanel/);
  assert.match(chat, /Usar Mesa redonda/);
  assert.match(admin, /Audit Control Center/);
  assert.match(admin, /Gates de execução/);
});


test("release identity is R0.7.0 realtime voice candidate", async () => {
  const identity = JSON.parse(
    await readFile(
      new URL("../release-identity.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(identity.release_version, "0.7.0");
  assert.equal(
    identity.release_id,
    "ORKIO-PREMIUM-REALTIME-VOICE-CORE-R0-7-0",
  );
  assert.equal(identity.channel, "audit-candidate");
});
