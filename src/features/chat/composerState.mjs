export function resolveComposerState({
  hasActiveThread,
  phase,
  content,
}) {
  const streaming = ["connecting", "streaming"].includes(
    phase,
  );
  const trimmed = String(content ?? "").trim();

  if (streaming) {
    return {
      disabled: true,
      canSend: false,
      label: "Transmitindo…",
      placeholder: "Aguarde a conclusão do stream.",
    };
  }

  if (!hasActiveThread) {
    return {
      disabled: true,
      canSend: false,
      label: "Crie uma conversa",
      placeholder:
        "Crie ou selecione uma conversa para começar.",
    };
  }

  return {
    disabled: false,
    canSend: trimmed.length > 0,
    label: "Enviar",
    placeholder: "Digite sua mensagem.",
  };
}
