export function AgentPicker({
  agents,
  selectedAgentId,
  onChange,
  disabled = false,
}) {
  return (
    <label className="agent-picker">
      <span>Agente responsável</span>
      <select
        value={selectedAgentId}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={disabled || agents.length === 0}
      >
        {agents.length === 0 && (
          <option value="">
            Carregando agentes…
          </option>
        )}
        {agents.map((agent) => (
          <option
            key={agent.agent_id}
            value={agent.agent_id}
          >
            {agent.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
