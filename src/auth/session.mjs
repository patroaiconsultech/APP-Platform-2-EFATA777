const STORAGE_KEY = "orkio.rc1.session";

export function validateSession(session) {
  if (!session?.tenantId || !session?.userId) throw new Error("AUTH_CONTEXT_REQUIRED");
  return {
    tenantId: String(session.tenantId),
    userId: String(session.userId),
    role: session.role === "admin" ? "admin" : "member",
  };
}

export function createSessionStore(storage = globalThis.localStorage) {
  let current = null;
  return {
    load() {
      if (!storage) return current;
      const raw = storage.getItem(STORAGE_KEY);
      current = raw ? validateSession(JSON.parse(raw)) : null;
      return current;
    },
    set(session) {
      current = validateSession(session);
      storage?.setItem(STORAGE_KEY, JSON.stringify(current));
      return current;
    },
    clear() { current = null; storage?.removeItem(STORAGE_KEY); },
    get() { return current; },
  };
}
