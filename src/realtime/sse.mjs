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


export function reduceSSEEvent(state, event) {
  if (state.terminal) {
    throw new Error("SSE_EVENT_AFTER_DONE");
  }

  const payload = eventPayload(event);
  const type = effectiveEventType(event);
  const next = {
    ...state,
    phase: "streaming",
    events: [...state.events, event],
    lastEventId: event.id ?? state.lastEventId,
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
  } else if (
    ["agent_started", "started", "metadata"].includes(type)
  ) {
    next.phase = "streaming";
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
    next.assistantMessage =
      payload.message ??
      event.data?.message ??
      payload ??
      null;
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
    next.phase = next.error
      ? "error"
      : next.cancelled || outcome === "cancelled"
        ? "cancelled"
        : "done";
  }

  return next;
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

  let state = {
    ...createTerminalState(),
    phase: "streaming",
    requestId: payload.request_id ?? null,
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

  if (!state.terminal) {
    throw terminalError(
      "SSE_TERMINAL_EVENT_MISSING",
      "SSE_TERMINAL_EVENT_MISSING: The stream ended without a terminal done event.",
    );
  }

  if (
    !state.error &&
    !state.cancelled &&
    !state.agentDone
  ) {
    throw terminalError(
      "SSE_AGENT_DONE_MISSING",
      "SSE_AGENT_DONE_MISSING: The stream ended without agent_done.",
    );
  }

  return state;
}
