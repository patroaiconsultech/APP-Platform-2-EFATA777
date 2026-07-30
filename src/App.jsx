import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "./api/client.mjs";
import { createSessionStore } from "./auth/session.mjs";
import { LoginPanel } from "./components/LoginPanel.jsx";
import { ThreadSidebar } from "./components/ThreadSidebar.jsx";
import { ChatConsole } from "./features/chat/ChatConsole.jsx";
import { AdminPanel } from "./features/admin/AdminPanel.jsx";
import {
  consumeSSE,
  createTerminalState,
} from "./realtime/sse.mjs";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const sessionStore = createSessionStore();

export default function App() {
  const [session, setSession] = useState(() => sessionStore.load());
  const [agents, setAgents] = useState([]);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("Orkio");
  const [streamState, setStreamState] = useState(createTerminalState());
  const [adminOverview, setAdminOverview] = useState(null);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE_URL,
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

  useEffect(() => {
    if (!session) return;
    Promise.all([api.listAgents(), api.listThreads()])
      .then(([agentData, threadData]) => {
        setAgents(agentData);
        setThreads(threadData);
        setActiveThreadId((current) => current ?? threadData[0]?.thread_id ?? null);
      })
      .catch((error) => {
        setStreamState((state) => ({
          ...state,
          phase: "error",
          error: { code: error.code, message: error.message },
        }));
      });

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
    api.listMessages(activeThreadId).then(setMessages);
  }, [session, activeThreadId]);

  function login(nextSession) {
    const validated = sessionStore.set(nextSession);
    setSession(validated);
  }

  async function createThread() {
    const title = `Nova conversa ${threads.length + 1}`;
    const thread = await api.createThread(title);
    await refreshThreads();
    setActiveThreadId(thread.thread_id);
  }

  async function send(content) {
    if (!activeThreadId) return;
    setStreamState({
      ...createTerminalState(),
      phase: "connecting",
    });

    const userMessage = {
      message_id: `local-${Date.now()}`,
      thread_id: activeThreadId,
      tenant_id: session.tenantId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const state = await consumeSSE({
        url: `${API_BASE_URL}/api/chat/stream`,
        payload: {
          thread_id: activeThreadId,
          content,
          requested_agent: selectedAgentId,
        },
        session,
        onState: setStreamState,
      });
      if (!state.terminal) {
        throw new Error("SSE_DONE_MISSING");
      }

      const response = await api.chat({
        thread_id: activeThreadId,
        content,
        requested_agent: selectedAgentId,
      });
      setMessages((current) => [
        ...current,
        {
          ...response,
          role: "assistant",
        },
      ]);
      setStreamState(createTerminalState());
    } catch (error) {
      setStreamState((state) => ({
        ...state,
        phase: "error",
        terminal: true,
        error: {
          code: error.code ?? "CHAT_FAILED",
          message: error.message,
        },
      }));
    }
  }

  if (!session) {
    return <LoginPanel onLogin={login} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">ORKIO PLATAFORMA 2.0</span>
          <h1>Command Center</h1>
        </div>
        <div className="identity">
          <strong>{session.userId}</strong>
          <span>{session.tenantId} · {session.role}</span>
          <button
            type="button"
            onClick={() => {
              sessionStore.clear();
              setSession(null);
            }}
          >
            Sair
          </button>
        </div>
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
          disabled={
            !activeThreadId ||
            ["connecting", "streaming"].includes(streamState.phase)
          }
        />
        {session.role === "admin" && (
          <AdminPanel overview={adminOverview} />
        )}
      </div>
    </main>
  );
}
