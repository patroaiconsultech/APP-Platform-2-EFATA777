const ROUND_TABLE_HEADING =
  /^[ \t]{0,3}#{1,6}[ \t]+(?:\*\*|__)?(Orkio|Orion|Chris|Laura)(?:\*\*|__)?[ \t]*(?:(?::|[-–—])[ \t]*[^\n]*)?[ \t]*$/gim;

const CANONICAL_AGENT = new Map(
  ["Orkio", "Orion", "Chris", "Laura"].map(
    (name) => [name.toLocaleLowerCase("en-US"), name],
  ),
);

const ROUND_TABLE_INTENT =
  /\b(cada\s+(agente|um)|todos\s+os\s+agentes|individualmente|each\s+agent|individually)\b/i;


export function formatMessageTimestamp(
  value,
  {
    locale = "pt-BR",
    timeZone,
  } = {},
) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const options = {
    dateStyle: "short",
    timeStyle: "short",
  };
  if (timeZone) options.timeZone = timeZone;

  return new Intl.DateTimeFormat(
    locale,
    options,
  )
    .format(date)
    .replace(/,\s*/, " · ");
}


export function parseRoundtableSections(content) {
  if (typeof content !== "string" || !content.trim()) {
    return [];
  }

  const matches = [...content.matchAll(ROUND_TABLE_HEADING)];
  if (matches.length < 2) return [];

  const sections = matches
    .map((match, index) => {
      const start = match.index + match[0].length;
      const end =
        matches[index + 1]?.index ?? content.length;
      return {
        agentId:
          CANONICAL_AGENT.get(
            match[1].toLocaleLowerCase("en-US"),
          ) ?? match[1],
        content: content.slice(start, end).trim(),
      };
    })
    .filter((item) => item.content);

  return sections.length >= 2 ? sections : [];
}


export function shouldSuggestRoundtable({
  content,
  selectedAgentId,
  interactionMode,
}) {
  return (
    selectedAgentId === "Team" &&
    interactionMode !== "roundtable" &&
    ROUND_TABLE_INTENT.test(content ?? "")
  );
}
