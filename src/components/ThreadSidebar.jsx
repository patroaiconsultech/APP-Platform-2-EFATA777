export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
}) {
  return (
    <aside className="thread-sidebar panel">
      <h2 className="panel-title">Conversas</h2>

      <button
        className="primary-action"
        type="button"
        onClick={onCreate}
      >
        + Nova conversa
      </button>

      <div className="thread-list">
        {threads.length === 0 && (
          <p className="empty-state">
            Nenhuma conversa disponível. Crie a
            primeira thread para liberar o console.
          </p>
        )}

        {threads.map((thread) => (
          <button
            className="thread-button"
            key={thread.thread_id}
            type="button"
            onClick={() =>
              onSelect(thread.thread_id)
            }
            aria-current={
              activeThreadId === thread.thread_id
                ? "page"
                : undefined
            }
          >
            {thread.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
