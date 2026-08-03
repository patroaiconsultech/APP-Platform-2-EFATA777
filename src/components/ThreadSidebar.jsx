import { useState } from "react";

import { AgentPicker } from "./AgentPicker.jsx";
import {
  InteractionModePicker,
} from "./InteractionModePicker.jsx";


export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
  onRename,
  agents,
  selectedAgentId,
  onAgentChange,
  interactionMode,
  onInteractionModeChange,
  controlsDisabled,
}) {
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [renameError, setRenameError] = useState(null);
  const [renaming, setRenaming] = useState(false);

  function beginRename(thread) {
    setEditingThreadId(thread.thread_id);
    setDraftTitle(thread.title);
    setRenameError(null);
  }

  function cancelRename() {
    setEditingThreadId(null);
    setDraftTitle("");
    setRenameError(null);
  }

  async function submitRename(event, threadId) {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title || renaming) return;

    setRenaming(true);
    setRenameError(null);
    try {
      await onRename(threadId, title);
      cancelRename();
    } catch (error) {
      setRenameError(
        error.message ?? "Não foi possível renomear a conversa.",
      );
    } finally {
      setRenaming(false);
    }
  }

  return (
    <aside className="thread-sidebar panel">
      <div className="thread-sidebar-heading">
        <h2 className="panel-title">Conversas</h2>
        <button
          className="primary-action"
          type="button"
          onClick={onCreate}
          disabled={controlsDisabled}
        >
          + Nova conversa
        </button>
      </div>

      <div className="thread-list">
        {threads.length === 0 && (
          <p className="empty-state">
            Nenhuma conversa disponível. Crie a
            primeira thread para liberar o console.
          </p>
        )}

        {threads.map((thread) => {
          const editing =
            editingThreadId === thread.thread_id;
          if (editing) {
            return (
              <form
                className="thread-rename-form"
                key={thread.thread_id}
                onSubmit={(event) =>
                  submitRename(event, thread.thread_id)
                }
              >
                <label>
                  <span className="sr-only">
                    Novo título da conversa
                  </span>
                  <input
                    autoFocus
                    maxLength={160}
                    value={draftTitle}
                    onChange={(event) =>
                      setDraftTitle(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        cancelRename();
                      }
                    }}
                    disabled={renaming}
                  />
                </label>
                <div className="thread-rename-actions">
                  <button
                    type="submit"
                    disabled={
                      renaming || !draftTitle.trim()
                    }
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    disabled={renaming}
                  >
                    Cancelar
                  </button>
                </div>
                {renameError && (
                  <small className="thread-rename-error">
                    {renameError}
                  </small>
                )}
              </form>
            );
          }

          return (
            <div
              className="thread-row"
              key={thread.thread_id}
            >
              <button
                className="thread-button"
                type="button"
                onClick={() =>
                  onSelect(thread.thread_id)
                }
                onDoubleClick={() => beginRename(thread)}
                aria-current={
                  activeThreadId === thread.thread_id
                    ? "page"
                    : undefined
                }
              >
                <span>{thread.title}</span>
              </button>
              <button
                className="thread-edit-button"
                type="button"
                onClick={() => beginRename(thread)}
                disabled={controlsDisabled}
                aria-label={`Renomear ${thread.title}`}
                title="Renomear conversa"
              >
                ✎
              </button>
            </div>
          );
        })}
      </div>

      <section
        className="sidebar-agent-controls"
        aria-label="Controles de agente e modo"
      >
        <span className="eyebrow">AGENTE E MODO</span>
        <AgentPicker
          agents={agents}
          selectedAgentId={selectedAgentId}
          onChange={onAgentChange}
          disabled={controlsDisabled}
        />
        <InteractionModePicker
          value={interactionMode}
          onChange={onInteractionModeChange}
          selectedAgentId={selectedAgentId}
          disabled={controlsDisabled}
        />
      </section>
    </aside>
  );
}
