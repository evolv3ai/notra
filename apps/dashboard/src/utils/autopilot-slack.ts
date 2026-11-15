/** Escapes the characters Slack mrkdwn treats as control sequences. */
export function escapeSlackText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** verbatim stops Slack from turning names like "Copy.ai" into links. */
export function slackMrkdwn(text: string) {
  return { type: "mrkdwn", text, verbatim: true } as const;
}

/** Keep generated copy on one line and escape after truncating, not mid-entity. */
export function compactSlackText(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return escapeSlackText(
    text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
  );
}
