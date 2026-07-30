export function AgentPicker({
  agents,
  selectedAgentId,
  onChange,
}) {
  return (
    <label className="agent-picker">
      Agente
      <select
        value={selectedAgentId}
        onChange={(event) => onChange(event.target.value)}
      >
        {agents.map((agent) => (
          <option key={agent.agent_id} value={agent.agent_id}>
            {agent.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
