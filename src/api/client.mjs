export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}


export function newRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `request_${globalThis.crypto
      .randomUUID()
      .replaceAll("-", "")}`;
  }
  return (
    `request_${Date.now()}_` +
    Math.random().toString(16).slice(2)
  );
}


function parseErrorDetail(body, status) {
  const detail = body?.error ?? body?.detail ?? {};
  return new ApiError(
    detail.code ?? "HTTP_ERROR",
    detail.message ??
      `Request failed with ${status}`,
    status,
  );
}


export function authHeaders(session) {
  if (session?.mode === "oidc_introspection") {
    if (!session.accessToken) {
      throw new ApiError(
        "AUTH_TOKEN_REQUIRED",
        "A bearer access token is required.",
        401,
      );
    }
    return {
      Authorization: `Bearer ${session.accessToken}`,
    };
  }

  if (
    session?.mode === "demo_headers" &&
    session.tenantId &&
    session.userId
  ) {
    return {
      "X-Tenant-ID": session.tenantId,
      "X-User-ID": session.userId,
      "X-Role": session.role ?? "member",
    };
  }

  throw new ApiError(
    "AUTH_CONTEXT_REQUIRED",
    "Authentication context is required.",
    401,
  );
}


export function createApiClient({
  baseUrl,
  getSession,
  fetchImpl = globalThis.fetch,
  onAuthFailure,
}) {
  if (!baseUrl) throw new Error("API_BASE_URL_REQUIRED");

  async function request(
    path,
    {
      requireAuth = true,
      requestId,
      headers,
      ...options
    } = {},
  ) {
    const session = getSession?.() ?? null;
    let identityHeaders = {};
    if (requireAuth) {
      try {
        identityHeaders = authHeaders(session);
      } catch (error) {
        onAuthFailure?.(error);
        throw error;
      }
    }

    const correlationId = requestId ?? newRequestId();
    const requestHeaders = {
      "X-Request-ID": correlationId,
      ...identityHeaders,
      ...(headers ?? {}),
    };
    if (options.body !== undefined) {
      requestHeaders["Content-Type"] =
        "application/json";
    }

    const response = await fetchImpl(
      `${baseUrl}${path}`,
      {
        ...options,
        headers: requestHeaders,
      },
    );

    const contentType =
      response.headers.get("content-type") ?? "";
    const body = contentType.includes(
      "application/json",
    )
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const error = parseErrorDetail(
        body,
        response.status,
      );
      if (
        error.status === 401 ||
        [
          "AUTH_PROVIDER_REQUIRED",
          "AUTH_CONTEXT_REQUIRED",
          "AUTH_CONTEXT_INVALID",
          "AUTH_CONTEXT_CONFLICT",
          "AUTH_TOKEN_REQUIRED",
          "AUTH_TOKEN_INVALID",
          "AUTH_TOKEN_INACTIVE",
          "AUTH_TOKEN_EXPIRED",
          "DEMO_ADMIN_DISABLED",
        ].includes(error.code)
      ) {
        onAuthFailure?.(error);
      }
      throw error;
    }

    return body;
  }

  return {
    authStatus: () =>
      request("/api/auth/status", {
        requireAuth: false,
      }),
    me: () => request("/api/auth/me"),
    listAgents: () => request("/api/agents"),
    listThreads: () => request("/api/threads"),
    createThread: (title) =>
      request("/api/threads", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    renameThread: (threadId, title) =>
      request(
        `/api/threads/${encodeURIComponent(threadId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title }),
        },
      ),
    listMessages: (threadId) =>
      request(
        `/api/threads/${encodeURIComponent(
          threadId,
        )}/messages`,
      ),
    completeChat: (payload) =>
      request("/api/chat", {
        method: "POST",
        requestId: payload.request_id,
        body: JSON.stringify(payload),
      }),
    cancelExecution: (
      executionRequestId,
      reason,
    ) =>
      request(
        `/api/chat/executions/${encodeURIComponent(
          executionRequestId,
        )}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      ),
    recordRecoveryDecision: (
      executionRequestId,
      decision,
      reason,
    ) =>
      request(
        `/api/governance/executions/${encodeURIComponent(
          executionRequestId,
        )}/recovery-decisions`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            reason,
          }),
        },
      ),
    adminOverview: () =>
      request("/api/admin/overview"),
    governanceStatus: () =>
      request("/api/governance/status"),
    listCapabilities: () =>
      request("/api/agents/capabilities"),
    createEvolutionProposal: (payload) =>
      request("/api/governance/evolution/proposals", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  };
}
