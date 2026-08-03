const MODES = [
  {
    value: "single",
    label: "Individual",
    description: "Somente o agente responsável",
  },
  {
    value: "team_synthesis",
    label: "Team · Síntese",
    description: "Especialistas contribuem; o owner consolida",
  },
  {
    value: "roundtable",
    label: "Mesa redonda",
    description: "Cada especialista aparece separadamente",
  },
];


export function InteractionModePicker({
  value,
  onChange,
  selectedAgentId,
  disabled,
}) {
  return (
    <div className="interaction-mode" role="group" aria-label="Modo de interação">
      {MODES.map((mode) => {
        const teamRecommended =
          selectedAgentId === "Team" &&
          mode.value === "team_synthesis";
        return (
          <button
            key={mode.value}
            type="button"
            className={
              value === mode.value
                ? "mode-button active"
                : "mode-button"
            }
            onClick={() => onChange(mode.value)}
            disabled={disabled}
            title={
              teamRecommended
                ? `${mode.description} · recomendado para Team`
                : mode.description
            }
            aria-pressed={value === mode.value}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
