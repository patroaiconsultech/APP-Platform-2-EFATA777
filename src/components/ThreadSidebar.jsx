export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <span className="eyebrow">CONVERSAS</span>
          <h2>Threads</h2>
        </div>
        <button type="button" onClick={onCreate}>Nova</button>
      </div>
      <nav>
        {threads.length === 0 && (
          <p className="muted">Nenhuma thread neste tenant.</p>
        )}
        {threads.map((thread) => (
          <button
            key={thread.thread_id}
            type="button"
            className={
              activeThreadId === thread.thread_id
                ? "thread active"
                : "thread"
            }
            onClick={() => onSelect(thread.thread_id)}
          >
            <strong>{thread.title}</strong>
            <span>{thread.thread_id.slice(0, 18)}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
