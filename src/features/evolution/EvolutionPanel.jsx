import { useState } from "react";


export function EvolutionPanel({
  governance,
  proposal,
  onCreateProposal,
  submitting,
}) {
  const [objective, setObjective] = useState("");
  const enabled =
    governance?.assisted_evolution_enabled === true;

  async function submit(event) {
    event.preventDefault();
    const value = objective.trim();
    if (!enabled || !value || submitting) return;
    await onCreateProposal({
      objective: value,
      evidence: [
        "Operator-requested proposal from the Evolution Control Center.",
      ],
      constraints: [
        "proposal_only",
        "No commit, merge, deploy or migration.",
      ],
      requested_agent: "Orion",
    });
  }

  return (
    <section className="evolution-panel panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">GOVERNANÇA</span>
          <h2>Evolution Control Center</h2>
        </div>
        <span
          className={
            enabled
              ? "runtime-badge enabled"
              : "runtime-badge disabled"
          }
        >
          {enabled ? "Proposal mode ativo" : "Bloqueado por flag"}
        </span>
      </div>

      <p className="panel-copy">
        Orion estrutura uma proposta técnica. Nenhuma escrita,
        commit, merge, migration ou deploy é executado.
      </p>

      <form className="evolution-form" onSubmit={submit}>
        <textarea
          value={objective}
          onChange={(event) =>
            setObjective(event.target.value)
          }
          placeholder="Descreva a evolução que deverá ser auditada e proposta."
          disabled={!enabled || submitting}
        />
        <button
          type="submit"
          className="secondary-action"
          disabled={
            !enabled ||
            submitting ||
            !objective.trim()
          }
        >
          {submitting
            ? "Gerando proposta…"
            : "Gerar proposta governada"}
        </button>
      </form>

      {proposal?.error && (
        <div className="error-panel">
          {proposal.error.message ?? proposal.error.code}
        </div>
      )}

      {proposal?.content && (
        <article className="proposal-card">
          <header>
            <strong>Proposta {proposal.proposal_id}</strong>
            <span>{proposal.status}</span>
          </header>
          <pre>{proposal.content}</pre>
          <footer className="governance-gates">
            <span>write=false</span>
            <span>commit=false</span>
            <span>merge=false</span>
            <span>deploy=false</span>
            <span>migration=false</span>
            <span>aprovação humana=true</span>
          </footer>
        </article>
      )}
    </section>
  );
}
