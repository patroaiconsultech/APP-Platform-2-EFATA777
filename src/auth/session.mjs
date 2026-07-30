const STORAGE_KEY = "orkio.rc0.session";

export function validateSession(session) {
  if (!session?.tenantId || !session?.userId) {
    throw new Error("AUTH_CONTEXT_REQUIRED");
  }
  return {
    tenantId: String(session.tenantId),
    userId: String(session.userId),
    role: session.role === "admin" ? "admin" : "member",
  };
}

export function createSessionStore(storage = globalThis.localStorage) {
  let current = null;

  function load() {
    if (!storage) return current;
    const raw = storage.getItem(STORAGE_KEY);
    current = raw ? validateSession(JSON.parse(raw)) : null;
    return current;
  }

  function set(session) {
    current = validateSession(session);
    storage?.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  }

  function clear() {
    current = null;
    storage?.removeItem(STORAGE_KEY);
  }

  function get() {
    return current;
  }

  return { load, set, clear, get };
}
