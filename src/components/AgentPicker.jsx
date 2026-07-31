export function AgentPicker({agents,selectedAgentId,onChange}) {
  return <label>Agente<select value={selectedAgentId} onChange={(e)=>onChange(e.target.value)}>
    {agents.map((agent)=><option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>)}
  </select></label>;
}
