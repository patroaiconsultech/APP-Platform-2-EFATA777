export function parseSSEBlock(block) {
  const event = { id: null, event: "message", data: null };
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
    event.data = text ? JSON.parse(text) : null;
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
    content: "",
    lastEventId: null,
    requestId: null,
    executionId: null,
    error: null,
    terminal: false,
    agentDone: false,
    cancelled: false,
    assistantMessage: null,
  };
}


export function reduceSSEEvent(state, event) {
  if (state.terminal) throw new Error("SSE_EVENT_AFTER_DONE");
  const next = {
    ...state,
    phase: "streaming",
    events: [...state.events, event],
    lastEventId: event.id ?? state.lastEventId,
  };
  if (event.event === "execution") {
    next.requestId =
      event.data?.payload?.request_id ?? state.requestId;
    next.executionId =
      event.data?.payload?.execution_id ??
      event.data?.execution_id ??
      state.executionId;
  } else if (
    event.event === "agent_chunk" ||
    event.event === "chunk"
  ) {
    next.content += event.data?.payload?.content ?? "";
  } else if (event.event === "agent_done") {
    next.agentDone = true;
    next.assistantMessage =
      event.data?.payload?.message ?? null;
  } else if (event.event === "error") {
    next.error =
      event.data?.payload ?? { code: "UNKNOWN_STREAM_ERROR" };
  } else if (event.event === "cancelled") {
    next.cancelled = true;
    next.phase = "cancelled";
    next.assistantMessage =
      event.data?.payload?.message ?? null;
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


function extractBlocks(buffer) {
  const blocks = [];
  let match;
  let offset = 0;
  const separator = /\r?\n\r?\n/g;
  while ((match = separator.exec(buffer)) !== null) {
    blocks.push(buffer.slice(offset, match.index));
    offset = match.index + match[0].length;
  }
  return { blocks, rest: buffer.slice(offset) };
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
      "X-Request-ID": payload.request_id,
      "X-Tenant-ID": session.tenantId,
      "X-User-ID": session.userId,
      "X-Role": session.role ?? "member",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`SSE_HTTP_${response.status}`);

  let state = {
    ...createTerminalState(),
    requestId: payload.request_id ?? null,
  };
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
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = extractBlocks(buffer);
      buffer = parsed.rest;
      for (const block of parsed.blocks) {
        if (block.trim()) apply(parseSSEBlock(block));
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) apply(parseSSEBlock(buffer));
  } else {
    for (const event of parseSSEText(await response.text())) {
      apply(event);
    }
  }

  if (!state.terminal) throw new Error("SSE_DONE_MISSING");
  if (
    !state.error &&
    !state.cancelled &&
    !state.agentDone
  ) {
    throw new Error("SSE_AGENT_DONE_MISSING");
  }
  return state;
}
