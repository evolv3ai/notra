/** Conservative completeness check, not a factual or editorial quality score. */
export function autopilotDraftIssue(content: string): string | null {
  const body = content
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (!body) {
    return "The article body is empty";
  }

  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!marker) {
      continue;
    }
    const delimiter = marker[1] ?? "";
    if (!fence) {
      fence = delimiter;
    } else if (
      delimiter[0] === fence[0] &&
      delimiter.length >= fence.length &&
      !marker[2]?.trim()
    ) {
      fence = null;
    }
  }
  if (fence) {
    return "The article has an unclosed code block";
  }

  const lastLine = body.split(/\r?\n/).at(-1) ?? "";
  // Markdown lists, tables, links and code blocks need not end in a full stop.
  if (
    /^\s*(?:[-*+] |\d+[.)] |\|)/.test(lastLine) ||
    /^\s*(?:`{3,}|~{3,})\s*$/.test(lastLine) ||
    /\]\([^\n)]+\)$/.test(lastLine) ||
    /[.!?…。！？؟।॥][\s"'’”»\])}*_`]*$/u.test(lastLine)
  ) {
    return null;
  }
  return "The article appears to end mid-sentence";
}
