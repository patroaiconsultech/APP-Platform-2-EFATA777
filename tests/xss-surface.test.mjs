import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";


async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(
    directory,
    { withFileTypes: true },
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await filesUnder(path));
    } else if (/\.(?:js|jsx|mjs|html)$/.test(entry.name)) {
      output.push(path);
    }
  }
  return output;
}


test("frontend source contains no high-risk DOM injection sinks", async () => {
  const forbidden = [
    "dangerouslySetInnerHTML",
    ".innerHTML",
    "document.write(",
    "eval(",
    "new Function(",
  ];
  const findings = [];

  for (const path of await filesUnder(
    fileURLToPath(new URL("../src", import.meta.url)),
  )) {
    const source = await readFile(path, "utf8");
    for (const token of forbidden) {
      if (source.includes(token)) {
        findings.push({ path, token });
      }
    }
  }

  assert.deepEqual(findings, []);
});
