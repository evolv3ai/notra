import {
  GEO_OPENCODE_HTTP_URL_PATTERN,
  GEO_OPENCODE_HTTP_URL_START_PATTERN,
  GEO_OPENCODE_MARKDOWN_BOLD_AFFIX_PATTERN,
  GEO_OPENCODE_TRAILING_URL_PUNCTUATION_PATTERN,
} from "@notra/ai/constants/geo-opencode";

function normalizeHttpUrl(value: string, emphasis = ""): string | null {
  let remainingEmphasis = emphasis;
  let trimmed = value.replace(
    GEO_OPENCODE_TRAILING_URL_PUNCTUATION_PATTERN,
    ""
  );
  let unmatchedClosings = trimmed.split(")").length - trimmed.split("(").length;
  while (true) {
    if (remainingEmphasis && trimmed.endsWith(remainingEmphasis)) {
      trimmed = trimmed
        .slice(0, -remainingEmphasis.length)
        .replace(GEO_OPENCODE_TRAILING_URL_PUNCTUATION_PATTERN, "");
      remainingEmphasis = "";
      continue;
    }
    if (!trimmed.endsWith(")") || unmatchedClosings <= 0) {
      break;
    }
    trimmed = trimmed
      .slice(0, -1)
      .replace(GEO_OPENCODE_TRAILING_URL_PUNCTUATION_PATTERN, "");
    unmatchedClosings -= 1;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function collectHttpUrlsFromString(value: string, urls: Set<string>): void {
  const pattern = new RegExp(
    GEO_OPENCODE_HTTP_URL_PATTERN.source,
    GEO_OPENCODE_HTTP_URL_PATTERN.flags.replace("g", "y")
  );
  let coveredUntil = 0;
  for (const match of value.matchAll(GEO_OPENCODE_HTTP_URL_START_PATTERN)) {
    if (match.index < coveredUntil) {
      continue;
    }
    pattern.lastIndex = match.index;
    const token = pattern.exec(value);
    if (!token) {
      continue;
    }
    let candidate = token[0];
    const prefix = value.slice(0, match.index);
    if (prefix.endsWith("[") && candidate.includes("](")) {
      continue;
    }
    if (prefix.endsWith("](")) {
      let depth = 0;
      for (let index = 0; index < candidate.length; index += 1) {
        if (candidate[index] === "(") {
          depth += 1;
        } else if (candidate[index] === ")") {
          if (depth === 0) {
            candidate = candidate.slice(0, index);
            break;
          }
          depth -= 1;
        }
      }
    }
    const emphasis = prefix.match(
      GEO_OPENCODE_MARKDOWN_BOLD_AFFIX_PATTERN
    )?.[0];
    const url = normalizeHttpUrl(candidate, emphasis);
    if (url) {
      urls.add(url);
      coveredUntil = match.index + candidate.length;
    }
  }
}

export function extractHttpUrls(value: unknown): string[] {
  const urls = new Set<string>();
  const visited = new Set<object>();

  const visit = (current: unknown): void => {
    if (typeof current === "string") {
      collectHttpUrlsFromString(current, urls);
      return;
    }
    if (typeof current !== "object" || current === null) {
      return;
    }
    if (visited.has(current)) {
      return;
    }
    visited.add(current);
    for (const nested of Array.isArray(current)
      ? current
      : Object.values(current)) {
      visit(nested);
    }
  };

  visit(value);
  return [...urls];
}
