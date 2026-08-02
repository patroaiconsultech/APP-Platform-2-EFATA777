const STORAGE_KEY = "orkio.auth.session.v2";
const LEGACY_KEY = "orkio.rc1.session";


export function validateSession(
  session,
  now = Date.now(),
) {
  if (session?.mode === "oidc_introspection") {
    const accessToken = String(
      session.accessToken ?? "",
    ).trim();
    const expiresAt = Number(session.expiresAt);
    if (!accessToken || !Number.isFinite(expiresAt)) {
      throw new Error("AUTH_TOKEN_INVALID");
    }
    if (expiresAt <= now + 5_000) {
      throw new Error("AUTH_TOKEN_EXPIRED");
    }
    return {
      mode: "oidc_introspection",
      accessToken,
      expiresAt,
      tenantId:
        session.tenantId
          ? String(session.tenantId)
          : null,
      userId:
        session.userId
          ? String(session.userId)
          : null,
      role:
        session.role === "admin"
          ? "admin"
          : session.role === "member"
            ? "member"
            : null,
    };
  }

  if (
    session?.mode === "demo_headers" ||
    (
      !session?.mode &&
      session?.tenantId &&
      session?.userId
    )
  ) {
    if (!session?.tenantId || !session?.userId) {
      throw new Error("AUTH_CONTEXT_REQUIRED");
    }
    return {
      mode: "demo_headers",
      tenantId: String(session.tenantId),
      userId: String(session.userId),
      role:
        session.role === "admin"
          ? "admin"
          : "member",
    };
  }

  throw new Error("AUTH_SESSION_INVALID");
}


export function createSessionStore(
  storage = globalThis.sessionStorage,
  legacyStorage = globalThis.localStorage,
) {
  let current = null;

  function clearLegacy() {
    legacyStorage?.removeItem(LEGACY_KEY);
  }

  return {
    load() {
      clearLegacy();
      if (!storage) return current;

      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        current = null;
        return null;
      }

      try {
        current = validateSession(JSON.parse(raw));
        return current;
      } catch {
        current = null;
        storage.removeItem(STORAGE_KEY);
        return null;
      }
    },

    set(session) {
      current = validateSession(session);
      storage?.setItem(
        STORAGE_KEY,
        JSON.stringify(current),
      );
      clearLegacy();
      return current;
    },

    clear() {
      current = null;
      storage?.removeItem(STORAGE_KEY);
      clearLegacy();
    },

    get() {
      return current;
    },
  };
}
