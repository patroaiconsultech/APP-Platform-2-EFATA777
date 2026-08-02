import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createStaticServer } from "../server.mjs";
import {
  buildContentSecurityPolicy,
  parseConnectSources,
} from "../src/security/csp.mjs";


test("CSP is deny-by-default without unsafe script directives", () => {
  const policy = buildContentSecurityPolicy({
    connectSources: parseConnectSources(
      "https://api.example.com https://id.example.com",
    ),
    production: true,
  });

  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(
    policy,
    /connect-src 'self' https:\/\/api\.example\.com https:\/\/id\.example\.com/,
  );
  assert.match(policy, /upgrade-insecure-requests/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(policy, /\*/);
});


test("production CSP rejects insecure remote origins", () => {
  assert.throws(
    () => buildContentSecurityPolicy({
      connectSources: parseConnectSources(
        "http://api.example.com",
      ),
      production: true,
    }),
    /CSP_CONNECT_HTTPS_REQUIRED/,
  );
});


test("CSP rejects paths, credentials and non-http origins", () => {
  assert.throws(
    () => parseConnectSources("https://example.com/path"),
    /CSP_CONNECT_ORIGIN_ONLY_REQUIRED/,
  );
  assert.throws(
    () => parseConnectSources("https://user@example.com"),
    /CSP_CONNECT_ORIGIN_ONLY_REQUIRED/,
  );
  assert.throws(
    () => parseConnectSources("javascript:alert(1)"),
    /CSP_CONNECT_PROTOCOL_INVALID/,
  );
});


test("static server emits CSP and hardening headers", async (t) => {
  const distDir = await mkdtemp(
    join(tmpdir(), "orkio-r042-"),
  );
  await writeFile(
    join(distDir, "index.html"),
    "<!doctype html><title>ORKIO</title>",
  );

  const server = createStaticServer({
    distDir,
    env: {
      PLATFORM_ENVIRONMENT: "production",
      ORKIO_CSP_CONNECT_SRC:
        "https://api.example.com https://id.example.com",
    },
  });
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(
    `http://127.0.0.1:${address.port}/`,
    { headers: { Accept: "text/html" } },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
  );
  assert.equal(
    response.headers.get("x-frame-options"),
    "DENY",
  );
  assert.match(
    response.headers.get("content-security-policy"),
    /connect-src 'self' https:\/\/api\.example\.com https:\/\/id\.example\.com/,
  );
});
