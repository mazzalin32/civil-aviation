/** Renders a stored message body, turning `@[Name](user:id)` tokens into highlighted `@Name`.
 *  `chip` is the Chat hub's pill style; `plain` is the Discussion tab's coloured text. */
export function MentionText({ text, variant = "plain" }: { text: string; variant?: "chip" | "plain" }) {
  const parts = text.split(/(@\[[^\]]+\]\(user:[^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/@\[([^\]]+)\]\(user:[^)]+\)/);
        if (!match) return <span key={i}>{part}</span>;
        return (
          <span
            key={i}
            className={variant === "chip" ? "inline-block rounded bg-primary-soft px-1 py-0.5 font-medium text-primary" : "font-medium text-primary"}
          >
            @{match[1]}
          </span>
        );
      })}
    </>
  );
}
