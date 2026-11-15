import type { JsonToken } from "@/types/sites-page";

const JSON_TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?)/g;

export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let last = 0;
  for (const match of source.matchAll(JSON_TOKEN)) {
    if (match.index > last) {
      tokens.push({
        kind: "punctuation",
        text: source.slice(last, match.index),
      });
    }
    if (match[1]) {
      tokens.push({ kind: match[2] ? "key" : "string", text: match[1] });
      if (match[2]) {
        tokens.push({ kind: "punctuation", text: match[2] });
      }
    } else {
      tokens.push({ kind: "literal", text: match[0] });
    }
    last = match.index + match[0].length;
  }
  if (last < source.length) {
    tokens.push({ kind: "punctuation", text: source.slice(last) });
  }
  return tokens;
}
