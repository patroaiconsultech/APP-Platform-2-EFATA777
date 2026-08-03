import {
  normalizeMessage,
} from "../contracts/message.mjs";
import {
  formatMessageTimestamp,
  parseRoundtableSections,
} from "../presentation/messageView.mjs";


function RoundtableContent({ sections }) {
  return (
    <div className="roundtable-message-grid">
      {sections.map((section, index) => (
        <section
          className="roundtable-message-card"
          key={`${section.agentId}-${index}`}
        >
          <strong>{section.agentId}</strong>
          <p>{section.content}</p>
        </section>
      ))}
    </div>
  );
}


export function MessageBubble({ message }) {
  const safe = normalizeMessage(message);
  const className =
    safe.role === "assistant"
      ? "message assistant"
      : "message user";
  const timestamp = formatMessageTimestamp(
    safe.created_at,
  );
  const sections =
    safe.role === "assistant"
      ? parseRoundtableSections(safe.content)
      : [];

  return (
    <article className={className}>
      <header className="message-header">
        <span>
          {safe.role === "assistant"
            ? safe.display_name
            : "Você"}
        </span>
        {timestamp && (
          <time dateTime={safe.created_at}>
            {timestamp}
          </time>
        )}
      </header>

      <div className="message-content">
        {sections.length ? (
          <RoundtableContent sections={sections} />
        ) : (
          <p>{safe.content}</p>
        )}
      </div>
    </article>
  );
}
