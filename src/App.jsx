import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createApiClient,
  newRequestId,
} from "./api/client.mjs";
import {
  isAuthFailure,
  normalizeAuthStatus,
  sessionMatchesAuthStatus,
} from "./auth/mode.mjs";
import {
  beginOidcLogin,
  exchangeOidcCallback,
  hasOidcCallback,
} from "./auth/oidc.mjs";
import { createSessionStore } from "./auth/session.mjs";
import {
  AuthUnavailablePanel,
} from "./components/AuthUnavailablePanel.jsx";
import { LoginPanel } from "./components/LoginPanel.jsx";
import {
  ThreadSidebar,
} from "./components/ThreadSidebar.jsx";
import {
  ChatConsole,
} from "./features/chat/ChatConsole.jsx";
import {
  AdminPanel,
} from "./features/admin/AdminPanel.jsx";
import { getRuntimeConfig } from "./config/runtime.mjs";
import {
  consumeSSE,
  createTerminalState,
} from "./realtime/sse.mjs";
import {
  reconcileMessages,
} from "./state/reconcile.mjs";

const runtime = getRuntimeConfig(import.meta.env);
const sessionStore = createSessionStore();


export default function App() {
  const [session, setSession] = useState(
    () => sessionStore.load(),
  );
  const [authStatus, setAuthStatus] = useState(null);
  const [authPhase, setAuthPhase] =
    useState("loading");
  const [authError, setAuthError] = useState(null);
  const [authEpoch, setAuthEpoch] = useState(0);

  const [agents, setAgents] = useState([]);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] =
    useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedAgentId, setSelectedAgentId] =
    useState("Orkio");
  const [streamState, setStreamState] =
    useState(createTerminalState());
  const [adminOverview, setAdminOverview] =
    useState(null);

  function resetProtectedState() {
    setAgents([]);
    setThreads([]);
    setActiveThreadId(null);
    setMessages([]);
    setAdminOverview(null);
    setStreamState(createTerminalState());
  }

  function invalidateSession(error) {
    if (!isAuthFailure(error)) return;
    sessionStore.clear();
    setSession(null);
    setAuthError({
      code: error.code ?? "AUTH_SESSION_INVALID",
      message:
        error.message ??
        "A sessão não é válida neste ambiente.",
    });
    resetProtectedState();
  }

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: runtime.apiBaseUrl,
        getSession: sessionStore.get,
        onAuthFailure: invalidateSession,
      }),
    [],
  );

  useEffect(() => {
    let active = true;

    async function discoverAuth() {
      setAuthPhase("loading");
      setAuthError(null);

      try {
        const raw = await api.authStatus();
        if (!active) return;

        const status = normalizeAuthStatus(raw);
        setAuthStatus(status);

        if (status.authMode === "external_required") {
          sessionStore.clear();
          setSession(null);
          resetProtectedState();
          setAuthPhase("blocked");
          return;
        }

        let stored = sessionStore.load();

        if (
          status.authMode === "oidc_introspection" &&
          hasOidcCallback()
        ) {
          stored = await exchangeOidcCallback({
            config: status.oidc,
          });
          if (stored) {
            stored = sessionStore.set(stored);
          }
        }

        if (
          stored &&
          !sessionMatchesAuthStatus(stored, status)
        ) {
          sessionStore.clear();
          stored = null;
          resetProtectedState();
        }

        setSession(stored);
        setAuthPhase("ready");
      } catch (error) {
        if (!active) return;
        sessionStore.clear();
        setSession(null);
        resetProtectedState();
        setAuthError({
          code: error.code ?? "AUTH_STATUS_FAILED",
          message:
            error.message ??
            "Não foi possível iniciar a autenticação.",
        });
        setAuthPhase("error");
      }
    }

    discoverAuth();

    return () => {
      active = false;
    };
  }, [authEpoch]);

  async function refreshThreads() {
    const data = await api.listThreads();
    setThreads(data);
    setActiveThreadId((current) => {
      if (
        current &&
        data.some(
          (item) => item.thread_id === current,
        )
      ) {
        return current;
      }
      return data[0]?.thread_id ?? null;
    });
    return data;
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
    if (
      authPhase !== "ready" ||
      !session
    ) {
      return;
    }

    let active = true;

    Promise.all([
      api.me(),
      api.listAgents(),
      api.listThreads(),
    ])
      .then(([principal, agentData, threadData]) => {
        if (!active) return;

        const enriched = sessionStore.set({
          ...session,
          tenantId: principal.tenant_id,
          userId: principal.user_id,
          role: principal.role,
        });
        if (
          enriched.tenantId !== session.tenantId ||
          enriched.userId !== session.userId ||
          enriched.role !== session.role
        ) {
          setSession(enriched);
        }

        setAgents(agentData);
        setThreads(threadData);
        setSelectedAgentId((current) => {
          if (
            agentData.some(
              (agent) => agent.agent_id === current,
            )
          ) {
            return current;
          }
          return agentData[0]?.agent_id ?? "Orkio";
        });
        setActiveThreadId(
          (current) =>
            current ??
            threadData[0]?.thread_id ??
            null,
        );
        setAuthError(null);

        if (principal.role === "admin") {
          api.adminOverview()
            .then((overview) => {
              if (active) setAdminOverview(overview);
            })
            .catch((error) => {
              if (
                active &&
                !isAuthFailure(error)
              ) {
                setAdminOverview(null);
              }
            });
        } else {
          setAdminOverview(null);
        }
      })
      .catch((error) => {
        if (!active || isAuthFailure(error)) return;
        setStreamState({
          ...createTerminalState(),
          phase: "error",
          terminal: true,
          error: {
            code: error.code ?? "BOOT_FAILED",
            message: error.message,
          },
        });
      });

    return () => {
      active = false;
    };
  }, [authPhase, session?.mode, session?.accessToken]);

  useEffect(() => {
    if (
      authPhase !== "ready" ||
      !session ||
      !activeThreadId
    ) {
      setMessages([]);
      return;
    }

    refreshMessages(activeThreadId).catch(
      (error) => {
        if (isAuthFailure(error)) return;
        setStreamState({
          ...createTerminalState(),
          phase: "error",
          terminal: true,
          error: {
            code:
              error.code ?? "MESSAGE_LOAD_FAILED",
            message: error.message,
          },
        });
      },
    );
  }, [
    authPhase,
    session?.mode,
    session?.accessToken,
    activeThreadId,
  ]);

  function loginDemo(nextSession) {
    if (
      !authStatus ||
      !sessionMatchesAuthStatus(
        nextSession,
        authStatus,
      )
    ) {
      setAuthError({
        code: "AUTH_CONTEXT_INVALID",
        message:
          "O perfil selecionado não é permitido neste ambiente.",
      });
      return;
    }

    const stored = sessionStore.set(nextSession);
    setSession(stored);
    setAuthError(null);
    setStreamState(createTerminalState());
  }

  async function loginOidc() {
    try {
      setAuthError(null);
      await beginOidcLogin({
        config: authStatus.oidc,
      });
    } catch (error) {
      setAuthError({
        code: error.code ?? "OIDC_LOGIN_FAILED",
        message:
          error.message ??
          "Não foi possível iniciar o login corporativo.",
      });
    }
  }

  function logout() {
    sessionStore.clear();
    setSession(null);
    resetProtectedState();
  }

  async function createThread() {
    try {
      const thread = await api.createThread(
        `Nova conversa ${threads.length + 1}`,
      );
      await refreshThreads();
      setActiveThreadId(thread.thread_id);
      setStreamState(createTerminalState());
    } catch (error) {
      if (isAuthFailure(error)) return;
      setStreamState({
        ...createTerminalState(),
        phase: "error",
        terminal: true,
        error: {
          code:
            error.code ?? "THREAD_CREATE_FAILED",
          message: error.message,
        },
      });
    }
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
      if (isAuthFailure(error)) return;
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
    if (!activeThreadId || !session) return;

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
        tenant_id:
          session.tenantId ?? "server-verified",
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
      if (isAuthFailure(error)) return;
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
      await refreshMessages(
        activeThreadId,
      ).catch(() => undefined);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (authPhase === "loading") {
    return (
      <main className="auth-gate">
        <section className="auth-card">
          <p className="loading-state">
            Verificando autenticação…
          </p>
        </section>
      </main>
    );
  }

  if (
    authPhase === "blocked" ||
    authPhase === "error"
  ) {
    return (
      <AuthUnavailablePanel
        authStatus={authStatus}
        error={authError}
        onRetry={() =>
          setAuthEpoch((value) => value + 1)
        }
      />
    );
  }

  if (!session) {
    return (
      <LoginPanel
        authStatus={authStatus}
        authError={authError}
        onDemoLogin={loginDemo}
        onOidcLogin={loginOidc}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark">O</div>
          <div className="brand-copy">
            <h1>ORKIO Command Center</h1>
            <p>
              Premium Auth & Console R0.4.2
            </p>
          </div>
        </div>

        <div className="header-session">
          <span className="session-chip">
            {session.userId ?? "validando usuário"}
          </span>
          <span className="session-chip">
            {session.tenantId ?? "validando tenant"}
          </span>
          <button type="button" onClick={logout}>
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
          onCancel={cancelActiveExecution}
          hasActiveThread={Boolean(activeThreadId)}
        />

        {session.role === "admin" && (
          <AdminPanel overview={adminOverview} />
        )}
      </div>
    </main>
  );
}
