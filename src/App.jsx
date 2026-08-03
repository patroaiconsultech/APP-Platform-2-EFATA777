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
import {
  EvolutionPanel,
} from "./features/evolution/EvolutionPanel.jsx";
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


function executionErrorMessage(error) {
  const code = error?.code ?? "CHAT_FAILED";
  const messages = {
    OWNER_CONTRACT_VIOLATION:
      "A síntese de Orkio foi bloqueada porque misturou conteúdo dos especialistas.",
    OWNER_CONTRACT_PARTIAL:
      "A síntese final não passou no contrato adaptativo; as contribuições foram preservadas.",
    SSE_TIMEOUT:
      "O stream excedeu o limite e foi encerrado.",
    THREAD_TITLE_REQUIRED:
      "Informe um título válido para a conversa.",
    THREAD_NOT_FOUND:
      "A conversa não foi encontrada neste tenant.",
  };
  return (
    messages[code] ??
    error?.message ??
    "A execução não pôde ser concluída."
  );
}


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
  const [interactionMode, setInteractionMode] =
    useState("single");
  const [realtimeEnabled, setRealtimeEnabled] =
    useState(true);
  const [streamState, setStreamState] =
    useState(createTerminalState());

  const [adminOverview, setAdminOverview] =
    useState(null);
  const [governance, setGovernance] = useState(null);
  const [capabilities, setCapabilities] = useState([]);
  const [proposal, setProposal] = useState(null);
  const [proposalSubmitting, setProposalSubmitting] =
    useState(false);

  function resetProtectedState() {
    setAgents([]);
    setThreads([]);
    setActiveThreadId(null);
    setMessages([]);
    setAdminOverview(null);
    setGovernance(null);
    setCapabilities([]);
    setProposal(null);
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

    api.governanceStatus()
      .then((status) => {
        if (!active) return;
        setGovernance(status);
        setRealtimeEnabled(
          status.realtime_streaming_enabled === true,
        );
      })
      .catch(() => {
        if (active) setGovernance(null);
      });

    api.listCapabilities()
      .then((items) => {
        if (active) setCapabilities(items);
      })
      .catch(() => {
        if (active) setCapabilities([]);
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

  async function renameThread(threadId, title) {
    try {
      const updated = await api.renameThread(
        threadId,
        title,
      );
      setThreads((current) =>
        current.map((thread) =>
          thread.thread_id === threadId
            ? updated
            : thread,
        ),
      );
      return updated;
    } catch (error) {
      if (isAuthFailure(error)) return null;
      throw new Error(
        executionErrorMessage({
          code: error.code ?? "THREAD_RENAME_FAILED",
          message: error.message,
        }),
      );
    }
  }

  function changeAgent(agentId) {
    setSelectedAgentId(agentId);
    if (
      agentId === "Team" &&
      interactionMode === "single"
    ) {
      setInteractionMode("team_synthesis");
    }
  }

  async function cancelActiveExecution() {
    const requestId = streamState.requestId;
    if (!requestId || !realtimeEnabled) return;

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
        transport: "http_json",
        terminalSource: "envelope",
        doneObserved: false,
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
    const payload = {
      request_id: requestId,
      thread_id: activeThreadId,
      content,
      requested_agent: selectedAgentId,
      interaction_mode: interactionMode,
    };
    const controller = new AbortController();
    const timeout = realtimeEnabled
      ? setTimeout(
          () => controller.abort(),
          runtime.streamTimeoutMs,
        )
      : null;

    setStreamState({
      ...createTerminalState(),
      phase: "connecting",
      requestId,
      interactionMode,
      transport: realtimeEnabled ? "sse" : "http_json",
      terminalSource: realtimeEnabled ? null : "envelope",
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
      if (realtimeEnabled) {
        const terminalState = await consumeSSE({
          url: `${runtime.apiBaseUrl}/api/chat/stream`,
          payload,
          session,
          signal: controller.signal,
          onState: setStreamState,
        });
        setStreamState(terminalState);
      } else {
        const response = await api.completeChat(payload);
        setStreamState({
          ...createTerminalState(),
          phase:
            response.status === "partial"
              ? "partial"
              : response.status === "cancelled"
                ? "cancelled"
                : response.status === "error"
                  ? "error"
                  : "done",
          terminal: true,
          agentDone: false,
          agentDoneObserved: false,
          doneObserved: false,
          partial: response.status === "partial",
          partialReason:
            response.status === "partial"
              ? response.error?.code ?? "EXECUTION_PARTIAL"
              : null,
          error:
            response.status === "error"
              ? response.error
              : null,
          transport: "http_json",
          terminalSource: "envelope",
          eventCount: 0,
          requestId,
          executionId: response.execution_id ?? null,
          routeFamily: response.route_family ?? null,
          ownerAgent: response.turn_owner ?? response.agent_id,
          ownerDisplayName:
            response.display_name ?? response.agent_name,
          ownershipLocked: true,
          realtimeStreaming: false,
          assistantMessage: response,
          ownerContract: response.owner_contract ?? null,
          tokenUsage: response.token_usage ?? null,
          latencyMs: response.latency_ms ?? null,
          interactionMode:
            response.interaction_mode ?? interactionMode,
          contributors: (
            response.contributions ?? []
          ).map((item) => ({
            agentId: item.agent_id,
            displayName: item.display_name,
            status: item.status ?? "success",
            statusReason: item.status_reason ?? null,
            content: item.content ?? "",
            model: item.model ?? null,
            provider: item.provider ?? null,
            tokenUsage: item.token_usage ?? null,
            retryCount: item.retry_count ?? 0,
            latencyMs: item.latency_ms ?? null,
            budgetExceeded: item.budget_exceeded ?? false,
            contractVersion: item.contract_version ?? null,
            assignedTask: item.assigned_task ?? null,
            taskSliceVersion:
              item.task_slice_version ?? null,
            explicitAssignment:
              item.explicit_assignment ?? false,
          })),
        });
      }

      await refreshMessages(activeThreadId);
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
          message: executionErrorMessage({
            code:
              error.name === "AbortError"
                ? "SSE_TIMEOUT"
                : error.code ?? "CHAT_FAILED",
            message: error.message,
          }),
        },
      }));
      await refreshMessages(
        activeThreadId,
      ).catch(() => undefined);
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  }

  async function createEvolutionProposal(payload) {
    setProposalSubmitting(true);
    setProposal(null);
    try {
      const created = await api.createEvolutionProposal(
        payload,
      );
      setProposal(created);
    } catch (error) {
      if (isAuthFailure(error)) return;
      setProposal({
        error: {
          code:
            error.code ?? "EVOLUTION_PROPOSAL_FAILED",
          message: error.message,
        },
      });
    } finally {
      setProposalSubmitting(false);
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
          <div className="brand-mark brand-orbit">O</div>
          <div className="brand-copy">
            <p className="eyebrow">PATROAI · INTELLIGENCE OS</p>
            <h1>ORKIO Command Center</h1>
            <p>Premium Demo Excellence & Adaptive Coordination R0.6.4</p>
          </div>
        </div>

        <div className="header-session">
          <span className="session-chip role-chip">
            {session.role ?? "validando papel"}
          </span>
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

      <div
        className={
          session.role === "admin"
            ? "workspace admin-workspace"
            : "workspace"
        }
      >
        <ThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelect={setActiveThreadId}
          onCreate={createThread}
          onRename={renameThread}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentChange={changeAgent}
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
          controlsDisabled={[
            "connecting",
            "streaming",
          ].includes(streamState.phase)}
        />

        <ChatConsole
          capabilities={capabilities}
          selectedAgentId={selectedAgentId}
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
          realtimeEnabled={realtimeEnabled}
          onRealtimeChange={setRealtimeEnabled}
          messages={messages}
          streamState={streamState}
          onSend={send}
          onCancel={cancelActiveExecution}
          hasActiveThread={Boolean(activeThreadId)}
          governance={governance}
        />

        {session.role === "admin" && (
          <div className="control-column">
            <AdminPanel
              overview={adminOverview}
              governance={governance}
              capabilities={capabilities}
            />
            <EvolutionPanel
              governance={governance}
              proposal={proposal}
              onCreateProposal={createEvolutionProposal}
              submitting={proposalSubmitting}
            />
          </div>
        )}
      </div>
    </main>
  );
}
