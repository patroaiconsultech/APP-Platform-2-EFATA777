import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionStore,
  validateSession,
} from "../src/auth/session.mjs";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test("session requires tenant and user", () => {
  assert.throws(
    () => validateSession({ tenantId: "tenant-a" }),
    /AUTH_CONTEXT_REQUIRED/,
  );
});

test("session store persists and clears", () => {
  const store = createSessionStore(memoryStorage());
  store.set({
    tenantId: "tenant-a",
    userId: "user-a",
    role: "admin",
  });
  assert.equal(store.get().role, "admin");
  store.clear();
  assert.equal(store.get(), null);
});
