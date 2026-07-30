export function createInitialState() {
  return {
    session: null,
    agents: [],
    threads: [],
    activeThreadId: null,
    messagesByThread: {},
    selectedAgentId: "Orkio",
    stream: {
      phase: "idle",
      content: "",
      error: null,
      lastEventId: null,
    },
  };
}
