import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";


async function source(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}


test("completed and streaming messages share a containment wrapper", async () => {
  const messageBubble = await source(
    "../src/components/MessageBubble.jsx",
  );
  const chatConsole = await source(
    "../src/features/chat/ChatConsole.jsx",
  );

  assert.match(messageBubble, /className="message-content"/);
  assert.match(chatConsole, /className="message-content"/);
});


test("message and agent content cannot exceed their visual containers", async () => {
  const css = await source("../src/index.css");

  assert.match(css, /\.message-content,/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /word-break:\s*break-word/);
  assert.match(css, /\.message-list\s*\{[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /\.roundtable-message-card,[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.agent-activity-card,[\s\S]*overflow:\s*hidden/);
});


test("admin mobile layout is single-column, bounded and scrollable", async () => {
  const css = await source("../src/index.css");
  const panel = await source(
    "../src/features/admin/AdminPanel.jsx",
  );

  assert.match(panel, /className="admin-panel-body"/);
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*\.admin-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(
    css,
    /\.admin-workspace \.control-column\s*\{[\s\S]*order:\s*2/,
  );
  assert.match(
    css,
    /\.admin-workspace \.chat-console\s*\{[\s\S]*order:\s*3/,
  );
  assert.match(
    css,
    /\.admin-panel-body\s*\{[\s\S]*max-height:[\s\S]*overflow-y:\s*auto/,
  );
  assert.match(
    css,
    /\.runtime-row strong\s*\{[\s\S]*text-align:\s*left/,
  );
});


test("R0.6.5 release identity is visible in frontend sources", async () => {
  const index = await source("../index.html");
  const identity = JSON.parse(
    await source("../release-identity.json"),
  );
  const packageJson = JSON.parse(
    await source("../package.json"),
  );

  assert.match(index, /Premium R0\.6\.5/);
  assert.equal(packageJson.version, "0.6.5");
  assert.equal(identity.release_version, "0.6.5");
  assert.equal(
    identity.release_id,
    "ORKIO-PREMIUM-RESPONSIVE-TENANT-TRUTH-R0-6-5",
  );
});
