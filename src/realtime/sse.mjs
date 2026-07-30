export function parseSSEBlock(block) {
  const event = {
    id: null,
    event: "message",
    data: null,
  };

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("id:")) {
      event.id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      event.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const text = line.slice(5).trim();
      event.data = text ? JSON.parse(text) : null;
    }
  }
  return event;
}

export function parseSSEText(text) {
  return text
    .split(/\r?\n\r?\n/)
    .filter((block) => block.trim().length > 0)
    .map(parseSSEBlock);
}

export function createTerminalState() {
  return {
    phase: "idle",
    events: [],
    content: "",
    lastEventId: null,
    error: null,
    terminal: false,
  };
}

export function reduceSSEEvent(state, event) {
  if (state.terminal) {
    throw new Error("SSE_EVENT_AFTER_DONE");
  }

  const next = {
    ...state,
    phase: "streaming",
    events: [...state.events, event],
    lastEventId: event.id ?? state.lastEventId,
  };

  if (event.event === "agent_chunk" || event.event === "chunk") {
    next.content += event.data?.payload?.content ?? "";
  } else if (event.event === "error") {
    next.error = event.data?.payload ?? {
      code: "UNKNOWN_STREAM_ERROR",
    };
  } else if (event.event === "cancelled") {
    next.phase = "cancelled";
  } else if (event.event === "done") {
    next.terminal = true;
    next.phase = next.error
      ? "error"
      : event.data?.payload?.outcome === "cancelled"
        ? "cancelled"
        : "done";
  }

  return next;
}

export async function consumeSSE({
  url,
  payload,
  session,
  signal,
  fetchImpl = globalThis.fetch,
  onState,
}) {
  const response = await fetchImpl(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-Tenant-ID": session.tenantId,
      "X-User-ID": session.userId,
      "X-Role": session.role ?? "member",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`SSE_HTTP_${response.status}`);
  }

  const text = await response.text();
  let state = createTerminalState();
  for (const event of parseSSEText(text)) {
    state = reduceSSEEvent(state, event);
    onState?.(state);
  }

  if (!state.terminal) {
    throw new Error("SSE_DONE_MISSING");
  }
  return state;
}
