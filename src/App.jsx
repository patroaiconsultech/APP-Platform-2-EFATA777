import { useEffect, useMemo, useState } from "react";

import {
  createApiClient,
  newRequestId,
} from "./api/client.mjs";
import { createSessionStore } from "./auth/session.mjs";
import { LoginPanel } from "./components/LoginPanel.jsx";
import { ThreadSidebar } from "./components/ThreadSidebar.jsx";
import { ChatConsole } from "./features/chat/ChatConsole.jsx";
import { AdminPanel } from "./features/admin/AdminPanel.jsx";
import { getRuntimeConfig } from "./config/runtime.mjs";
import {
  consumeSSE,
  createTerminalState,
} from "./realtime/sse.mjs";
import { reconcileMessages } from "./state/reconcile.mjs";

const runtime = getRuntimeConfig(import.meta.env);
const sessionStore = createSessionStore();


export default function App() {
  const [session, setSession] = useState(
    () => sessionStore.load(),
  );
  const [agents, setAgents] = useState([]);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedAgentId, setSelectedAgentId] =
    useState("Orkio");
  const [streamState, setStreamState] =
    useState(createTerminalState());
  const [adminOverview, setAdminOverview] = useState(null);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: runtime.apiBaseUrl,
        getSession: sessionStore.get,
      }),
    [],
  );

  async function refreshThreads() {
    const data = await api.listThreads();
    setThreads(data);
    if (!activeThreadId && data[0]) {
      setActiveThreadId(data[0].thread_id);
    }
  }

  async function refreshMessages(
    threadId = activeThreadId,
  ) {
    if (!threadId) return [];
    const data = reconcileMessages(
      await api.listMessages(threadId),
    );
    setMessages(data);
    return data;
  }

  useEffect(() => {
    if (!session) return;
    Promise.all([
      api.listAgents(),
      api.listThreads(),
    ])
      .then(([agentData, threadData]) => {
        setAgents(agentData);
        setThreads(threadData);
        setActiveThreadId(
          (current) =>
            current ?? threadData[0]?.thread_id ?? null,
        );
      })
      .catch((error) =>
        setStreamState({
          ...createTerminalState(),
          phase: "error",
          terminal: true,
          error: {
            code: error.code ?? "BOOT_FAILED",
            message: error.message,
          },
        }),
      );

    if (session.role === "admin") {
      api.adminOverview()
        .then(setAdminOverview)
        .catch(() => setAdminOverview(null));
    }
  }, [session]);

  useEffect(() => {
    if (!session || !activeThreadId) {
      setMessages([]);
      return;
    }
    refreshMessages(activeThreadId).catch((error) =>
      setStreamState({
        ...createTerminalState(),
        phase: "error",
        terminal: true,
        error: {
          code: error.code ?? "MESSAGE_LOAD_FAILED",
          message: error.message,
        },
      }),
    );
  }, [session, activeThreadId]);

  async function createThread() {
    const thread = await api.createThread(
      `Nova conversa ${threads.length + 1}`,
    );
    await refreshThreads();
    setActiveThreadId(thread.thread_id);
  }

  async function cancelActiveExecution() {
    const requestId = streamState.requestId;
    if (!requestId) return;
    try {
      const cancelled = await api.cancelExecution(
        requestId,
        "Cancelled by the frontend operator.",
      );
      setStreamState((state) => ({
        ...state,
        phase: "cancelled",
        terminal: true,
        cancelled: true,
        assistantMessage: cancelled,
      }));
      await refreshMessages(activeThreadId);
    } catch (error) {
      setStreamState((state) => ({
        ...state,
        phase: "error",
        terminal: true,
        error: {
          code: error.code ?? "CANCEL_FAILED",
          message: error.message,
        },
      }));
    }
  }

  async function send(content) {
    if (!activeThreadId) return;
    const requestId = newRequestId();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      runtime.streamTimeoutMs,
    );

    setStreamState({
      ...createTerminalState(),
      phase: "connecting",
      requestId,
    });
    setMessages((current) => [
      ...current,
      {
        message_id: `local-${requestId}`,
        request_id: requestId,
        thread_id: activeThreadId,
        tenant_id: session.tenantId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      await consumeSSE({
        url: `${runtime.apiBaseUrl}/api/chat/stream`,
        payload: {
          request_id: requestId,
          thread_id: activeThreadId,
          content,
          requested_agent: selectedAgentId,
        },
        session,
        signal: controller.signal,
        onState: setStreamState,
      });
      await refreshMessages(activeThreadId);
      setStreamState(createTerminalState());
    } catch (error) {
      setStreamState((state) => ({
        ...state,
        phase: "error",
        terminal: true,
        error: {
          code:
            error.name === "AbortError"
              ? "SSE_TIMEOUT"
              : error.code ?? "CHAT_FAILED",
          message:
            error.name === "AbortError"
              ? "O stream excedeu o limite."
              : error.message,
        },
      }));
      await refreshMessages(activeThreadId).catch(
        () => undefined,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!session) {
    return (
      <LoginPanel
        onLogin={(next) =>
          setSession(sessionStore.set(next))
        }
      />
    );
  }

  return (
    <main className="app-shell">
      <header>
        <h1>
          ORKIO Command Center · RC1 Premium Hardening
        </h1>
        <strong>
          {session.userId} · {session.tenantId}
        </strong>
        <button
          onClick={() => {
            sessionStore.clear();
            setSession(null);
          }}
        >
          Sair
        </button>
      </header>
      <div className="workspace">
        <ThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelect={setActiveThreadId}
          onCreate={createThread}
        />
        <ChatConsole
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentChange={setSelectedAgentId}
          messages={messages}
          streamState={streamState}
          onSend={send}
          onCancel={cancelActiveExecution}
          disabled={
            !activeThreadId ||
            ["connecting", "streaming"].includes(
              streamState.phase,
            )
          }
        />
        {session.role === "admin" && (
          <AdminPanel overview={adminOverview} />
        )}
      </div>
    </main>
  );
}
