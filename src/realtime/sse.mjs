import { ApiError, authHeaders } from "../api/client.mjs";


export function parseSSEBlock(block) {
  const event = {
    id: null,
    event: "message",
    data: null,
  };
  const dataLines = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("id:")) {
      event.id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      event.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length) {
    const text = dataLines.join("\n");
    try {
      event.data = text ? JSON.parse(text) : null;
    } catch {
      event.data = { content: text };
    }
  }

  return event;
}


export function parseSSEText(text) {
  return text
    .split(/\r?\n\r?\n/)
    .filter((block) => block.trim())
    .map(parseSSEBlock);
}


export function createTerminalState() {
  return {
    phase: "idle",
    events: [],
    eventCount: 0,
    content: "",
    lastEventId: null,
    requestId: null,
    executionId: null,
    routeFamily: null,
    interactionMode: "single",
    ownerAgent: null,
    ownerDisplayName: null,
    ownershipLocked: false,
    realtimeStreaming: false,
    contributors: [],
    error: null,
    terminal: false,
    agentDone: false,
    agentDoneObserved: false,
    doneObserved: false,
    transport: null,
    terminalSource: null,
    cancelled: false,
    partial: false,
    partialReason: null,
    assistantMessage: null,
    ownerContract: null,
    tokenUsage: null,
    latencyMs: null,
  };
}


function eventPayload(event) {
  return event.data?.payload ?? event.data ?? {};
}


function effectiveEventType(event) {
  const payload = eventPayload(event);
  return (
    event.data?.type ??
    event.data?.event ??
    payload?.type ??
    payload?.event ??
    event.event ??
    "message"
  );
}


function normalizeContribution(payload, previous = {}) {
  return {
    nodeId: payload.node_id ?? previous.nodeId ?? null,
    agentId: payload.agent_id ?? previous.agentId ?? "unknown",
    displayName:
      payload.display_name ??
      previous.displayName ??
      payload.agent_id ??
      "Agente",
    status:
      payload.status ??
      (
        payload.phase === "node_completed"
          ? "success"
          : previous.status ?? "running"
      ),
    statusReason:
      payload.status_reason ??
      previous.statusReason ??
      null,
    content: payload.content ?? previous.content ?? "",
    model: payload.model ?? previous.model ?? null,
    provider: payload.provider ?? previous.provider ?? null,
    tokenUsage: payload.token_usage ?? previous.tokenUsage ?? null,
    retryCount:
      payload.retry_count ?? previous.retryCount ?? 0,
    latencyMs:
      payload.latency_ms ?? previous.latencyMs ?? null,
    budgetExceeded:
      payload.budget_exceeded ??
      previous.budgetExceeded ??
      false,
    contractVersion:
      payload.contract_version ??
      previous.contractVersion ??
      null,
    assignedTask:
      payload.assigned_task ??
      previous.assignedTask ??
      null,
    taskSliceVersion:
      payload.task_slice_version ??
      previous.taskSliceVersion ??
      null,
    explicitAssignment:
      payload.explicit_assignment ??
      previous.explicitAssignment ??
      false,
  };
}


function upsertContribution(contributors, payload) {
  const agentId = payload.agent_id ?? "unknown";
  const index = contributors.findIndex(
    (item) => item.agentId === agentId,
  );
  if (index < 0) {
    return [
      ...contributors,
      normalizeContribution(payload),
    ];
  }

  const next = [...contributors];
  next[index] = normalizeContribution(
    payload,
    contributors[index],
  );
  return next;
}


function mergeTerminalContributions(current, message) {
  const terminal = Array.isArray(message?.contributions)
    ? message.contributions
    : [];
  let next = current;
  for (const item of terminal) {
    next = upsertContribution(next, {
      ...item,
      phase: "node_completed",
    });
  }
  return next;
}


export function reduceSSEEvent(state, event) {
  if (state.terminal) {
    throw new Error("SSE_EVENT_AFTER_DONE");
  }

  const payload = eventPayload(event);
  const type = effectiveEventType(event);
  const nextEvents = [...state.events, event];
  const next = {
    ...state,
    phase: "streaming",
    events: nextEvents,
    eventCount: nextEvents.length,
    lastEventId: event.id ?? state.lastEventId,
    transport: state.transport ?? "sse",
    terminalSource: state.terminalSource,
  };

  if (type === "execution") {
    next.requestId =
      payload.request_id ??
      event.data?.request_id ??
      state.requestId;
    next.executionId =
      payload.execution_id ??
      event.data?.execution_id ??
      state.executionId;
    next.routeFamily =
      payload.route_family ?? state.routeFamily;
    next.interactionMode =
      payload.interaction_mode ??
      state.interactionMode;

    if (payload.phase === "node_started") {
      next.contributors = upsertContribution(
        state.contributors,
        payload,
      );
    } else if (payload.phase === "node_completed") {
      next.contributors = upsertContribution(
        state.contributors,
        payload,
      );
    }
  } else if (type === "agent_contribution_started") {
    next.contributors = upsertContribution(
      state.contributors,
      {
        ...payload,
        status: "running",
      },
    );
  } else if (type === "agent_contribution_done") {
    next.contributors = upsertContribution(
      state.contributors,
      {
        ...payload,
        phase: "node_completed",
      },
    );
  } else if (
    ["agent_started", "started", "metadata"].includes(type)
  ) {
    next.phase = "streaming";
    next.ownerAgent =
      payload.agent_id ?? state.ownerAgent;
    next.ownerDisplayName =
      payload.display_name ??
      state.ownerDisplayName ??
      payload.agent_id ??
      null;
    next.ownershipLocked =
      payload.ownership_locked ??
      state.ownershipLocked;
    next.interactionMode =
      payload.interaction_mode ??
      state.interactionMode;
    next.realtimeStreaming =
      payload.realtime_streaming ??
      state.realtimeStreaming;
  } else if (
    [
      "agent_chunk",
      "chunk",
      "delta",
      "token",
      "content_delta",
    ].includes(type)
  ) {
    next.content += String(
      payload.content ??
      payload.delta ??
      payload.text ??
      event.data?.content ??
      event.data?.delta ??
      event.data?.text ??
      "",
    );
  } else if (type === "agent_done") {
    next.agentDone = true;
    next.agentDoneObserved = true;
    next.transport = "sse";
    next.terminalSource = state.terminalSource;
    next.assistantMessage =
      payload.message ??
      event.data?.message ??
      payload ??
      null;
    next.contributors = mergeTerminalContributions(
      state.contributors,
      next.assistantMessage,
    );
    next.tokenUsage =
      next.assistantMessage?.token_usage ??
      state.tokenUsage;
    next.latencyMs =
      next.assistantMessage?.latency_ms ??
      state.latencyMs;
    next.ownerContract =
      next.assistantMessage?.owner_contract ??
      state.ownerContract;
  } else if (type === "partial") {
    next.partial = true;
    next.phase = "partial";
    next.partialReason =
      payload.reason ??
      event.data?.reason ??
      "EXECUTION_PARTIAL";
    next.assistantMessage =
      payload.message ??
      event.data?.message ??
      null;
    next.contributors = mergeTerminalContributions(
      state.contributors,
      next.assistantMessage,
    );
    next.tokenUsage =
      next.assistantMessage?.token_usage ??
      state.tokenUsage;
    next.latencyMs =
      next.assistantMessage?.latency_ms ??
      state.latencyMs;
    next.ownerContract =
      next.assistantMessage?.owner_contract ??
      state.ownerContract;
  } else if (type === "error") {
    next.error =
      payload.error ??
      payload ??
      { code: "UNKNOWN_STREAM_ERROR" };
    next.phase = "error";
  } else if (type === "cancelled") {
    next.cancelled = true;
    next.phase = "cancelled";
    next.assistantMessage =
      payload.message ??
      event.data?.message ??
      null;
  } else if (type === "done") {
    const outcome =
      payload.outcome ??
      event.data?.outcome ??
      null;
    next.terminal = true;
    next.doneObserved = true;
    next.transport = "sse";
    next.terminalSource = "wire";
    next.eventCount = next.events.length;
    next.lastEventId = event.id ?? next.lastEventId;
    next.phase = next.error
      ? "error"
      : next.cancelled || outcome === "cancelled"
        ? "cancelled"
        : next.partial || outcome === "partial"
          ? "partial"
          : "done";
  }

  return next;
}


export function summarizeTerminalEvidence(state) {
  const eventCount =
    state.eventCount ?? state.events?.length ?? 0;

  if (!state.terminal) {
    return {
      label: "aguardando terminal",
      complete: false,
      warning: false,
    };
  }

  if (state.transport === "sse") {
    if (!state.doneObserved) {
      return {
        label: "SSE sem done",
        complete: false,
        warning: true,
      };
    }
    if (state.error) {
      return {
        label: "error + done",
        complete: true,
        warning: false,
      };
    }
    if (state.partial) {
      return {
        label: "partial + done",
        complete: true,
        warning: true,
      };
    }
    if (state.cancelled) {
      return {
        label: "cancelled + done",
        complete: true,
        warning: false,
      };
    }
    if (state.agentDoneObserved && eventCount > 0) {
      return {
        label: "agent_done + done",
        complete: true,
        warning: false,
      };
    }
    return {
      label: "done sem agent_done",
      complete: false,
      warning: true,
    };
  }

  if (state.transport === "http_json") {
    return {
      label: state.error
        ? "envelope error"
        : state.cancelled
          ? "envelope cancelled"
          : state.partial || state.assistantMessage?.status === "partial"
            ? "envelope partial"
            : "envelope success",
      complete: true,
      warning: false,
    };
  }

  return {
    label: "terminal não comprovado",
    complete: false,
    warning: true,
  };
}


function parseError(body, status) {
  const detail = body?.error ?? body?.detail ?? {};
  return new ApiError(
    detail.code ?? "SSE_HTTP_ERROR",
    detail.message ??
      `Stream request failed with ${status}`,
    status,
  );
}


function extractBlocks(buffer) {
  const blocks = [];
  let match;
  let offset = 0;
  const separator = /\r?\n\r?\n/g;

  while ((match = separator.exec(buffer)) !== null) {
    blocks.push(buffer.slice(offset, match.index));
    offset = match.index + match[0].length;
  }

  return {
    blocks,
    rest: buffer.slice(offset),
  };
}


function terminalError(code, message) {
  return new ApiError(code, message, 502);
}


export async function consumeSSE({
  url,
  payload,
  session,
  signal,
  onState,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeaders(session),
      "X-Request-ID": payload.request_id,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    throw parseError(body, response.status);
  }

  const declaredContentType =
    response.headers?.get?.("content-type") ?? null;
  if (
    declaredContentType !== null &&
    !declaredContentType
      .toLowerCase()
      .includes("text/event-stream")
  ) {
    throw terminalError(
      "SSE_CONTENT_TYPE_INVALID",
      "The endpoint did not return text/event-stream.",
    );
  }

  let state = {
    ...createTerminalState(),
    phase: "streaming",
    transport: "sse",
    terminalSource: null,
    requestId: payload.request_id ?? null,
    interactionMode:
      payload.interaction_mode ?? "single",
  };
  onState?.(state);

  const apply = (event) => {
    state = reduceSSEEvent(state, event);
    onState?.(state);
  };

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(
        value ?? new Uint8Array(),
        { stream: !done },
      );

      const parsed = extractBlocks(buffer);
      buffer = parsed.rest;
      for (const block of parsed.blocks) {
        if (block.trim()) {
          apply(parseSSEBlock(block));
        }
      }

      if (done) break;
    }

    if (buffer.trim()) {
      apply(parseSSEBlock(buffer));
    }
  } else if (typeof response.text === "function") {
    for (const event of parseSSEText(
      await response.text(),
    )) {
      apply(event);
    }
  } else {
    throw terminalError(
      "SSE_BODY_MISSING",
      "The stream response body is unavailable.",
    );
  }

  if (!state.terminal || !state.doneObserved) {
    throw terminalError(
      "SSE_TERMINAL_EVENT_MISSING",
      "SSE_TERMINAL_EVENT_MISSING: The stream ended without a terminal done event.",
    );
  }

  if (
    !state.error &&
    !state.cancelled &&
    !state.agentDoneObserved
  ) {
    throw terminalError(
      "SSE_AGENT_DONE_MISSING",
      "SSE_AGENT_DONE_MISSING: The stream ended without agent_done.",
    );
  }

  return state;
}
