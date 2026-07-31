export function ThreadSidebar({threads,activeThreadId,onSelect,onCreate}) {
  return <aside><button type="button" onClick={onCreate}>Nova conversa</button>
    {threads.map((thread)=><button key={thread.thread_id} type="button"
      onClick={()=>onSelect(thread.thread_id)}
      aria-current={activeThreadId === thread.thread_id ? "page" : undefined}>
      {thread.title}
    </button>)}
  </aside>;
}
