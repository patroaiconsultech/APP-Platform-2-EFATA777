export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}


export function newRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `request_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
  }
  return `request_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}


export function createApiClient({
  baseUrl,
  getSession,
  fetchImpl = globalThis.fetch,
}) {
  if (!baseUrl) throw new Error("API_BASE_URL_REQUIRED");

  async function request(path, options = {}) {
    const session = getSession();
    if (!session?.tenantId || !session?.userId) {
      throw new ApiError(
        "AUTH_CONTEXT_REQUIRED",
        "Tenant and user context are required.",
        401,
      );
    }
    const requestId = options.requestId ?? newRequestId();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Tenant-ID": session.tenantId,
        "X-User-ID": session.userId,
        "X-Role": session.role ?? "member",
        ...(options.headers ?? {}),
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const detail = body?.error ?? body?.detail ?? {};
      throw new ApiError(
        detail.code ?? "HTTP_ERROR",
        detail.message ?? `Request failed with ${response.status}`,
        response.status,
      );
    }
    return body;
  }

  return {
    listAgents: () => request("/api/agents"),
    listThreads: () => request("/api/threads"),
    createThread: (title) =>
      request("/api/threads", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    listMessages: (threadId) =>
      request(
        `/api/threads/${encodeURIComponent(threadId)}/messages`,
      ),
    cancelExecution: (executionRequestId, reason) =>
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
          body: JSON.stringify({ decision, reason }),
        },
      ),
    adminOverview: () => request("/api/admin/overview"),
    governanceStatus: () => request("/api/governance/status"),
  };
}
