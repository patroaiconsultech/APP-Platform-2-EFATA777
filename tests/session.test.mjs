import test from "node:test";
import assert from "node:assert/strict";

import {
  createSessionStore,
} from "../src/auth/session.mjs";


function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    has(key) {
      return values.has(key);
    },
  };
}


test("legacy localStorage demo session is removed", () => {
  const sessionStorage = memoryStorage();
  const legacyStorage = memoryStorage({
    "orkio.rc1.session":
      JSON.stringify({
        tenantId: "tenant-demo",
        userId: "user-demo",
      }),
  });
  const store = createSessionStore(
    sessionStorage,
    legacyStorage,
  );

  assert.equal(store.load(), null);
  assert.equal(
    legacyStorage.has("orkio.rc1.session"),
    false,
  );
});


test("valid demo session round trips in sessionStorage", () => {
  const storage = memoryStorage();
  const store = createSessionStore(
    storage,
    memoryStorage(),
  );
  store.set({
    mode: "demo_headers",
    tenantId: "tenant-demo",
    userId: "user-demo",
    role: "member",
  });

  assert.deepEqual(store.load(), {
    mode: "demo_headers",
    tenantId: "tenant-demo",
    userId: "user-demo",
    role: "member",
  });
});


test("expired OIDC token is removed", () => {
  const storage = memoryStorage({
    "orkio.auth.session.v2": JSON.stringify({
      mode: "oidc_introspection",
      accessToken: "expired",
      expiresAt: 1,
    }),
  });
  const store = createSessionStore(
    storage,
    memoryStorage(),
  );

  assert.equal(store.load(), null);
  assert.equal(
    storage.has("orkio.auth.session.v2"),
    false,
  );
});


test("OIDC token round trips without refresh token", () => {
  const storage = memoryStorage();
  const store = createSessionStore(
    storage,
    memoryStorage(),
  );
  const future = Date.now() + 60_000;

  const saved = store.set({
    mode: "oidc_introspection",
    accessToken: "access-token",
    refreshToken: "must-not-survive",
    expiresAt: future,
  });

  assert.equal(saved.accessToken, "access-token");
  assert.equal(saved.refreshToken, undefined);
  assert.equal(store.load().refreshToken, undefined);
});
