import {
  ATTRIBUTE,
  ENTITY,
  HTML_NAMED_ENTITIES,
  HTML_RAW_TEXT_ELEMENTS,
  HTML_VOID_ELEMENTS,
  TAG,
  WHITESPACE,
} from "../constants/html";
import type { HtmlToken } from "../types/html";

function safeCodePoint(code: number): string | null {
  return Number.isInteger(code) && code > 0 && code <= 0x10_ff_ff
    ? String.fromCodePoint(code)
    : null;
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(ENTITY, (match, decimal, hex, name) => {
    if (decimal) {
      return safeCodePoint(Number.parseInt(decimal, 10)) ?? match;
    }
    if (hex) {
      return safeCodePoint(Number.parseInt(hex, 16)) ?? match;
    }
    return HTML_NAMED_ENTITIES[String(name).toLowerCase()] ?? match;
  });
}

export function collapseHtmlText(value: string): string {
  return decodeHtmlEntities(value).replace(WHITESPACE, " ").trim();
}

function parseAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1]?.toLowerCase();
    if (!name || attrs.has(name)) {
      continue;
    }
    attrs.set(name, decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attrs;
}

function openTagEnd(html: string, start: number): number {
  let index = start + 1;
  while (index < html.length) {
    const char = html[index];
    if (char === ">") {
      return index + 1;
    }
    if (char === "=") {
      let next = index + 1;
      while (next < html.length && /\s/.test(html[next] ?? "")) {
        next += 1;
      }
      const quote = html[next];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, next + 1);
        index = close === -1 ? next + 1 : close + 1;
        continue;
      }
    }
    index += 1;
  }
  return -1;
}

// Each candidate tag is matched against a slice that ends at its own
// terminator, so malformed markup cannot make the regex rescan the rest of
// the document from every "<" (quadratic on attacker-chosen pages).
function tagCandidateEnd(
  html: string,
  start: number,
  lastCommentClose: number
): number {
  const next = html[start + 1] ?? "";
  if (html.startsWith("<!--", start) && lastCommentClose >= start + 4) {
    return html.indexOf("-->", start + 4) + 3;
  }
  if (next === "!") {
    const close = html.indexOf(">", start);
    return close === -1 ? -1 : close + 1;
  }
  return /[a-zA-Z]/.test(next) ? openTagEnd(html, start) : start;
}

export function* tokenizeHtml(html: string): Generator<HtmlToken> {
  const tag = new RegExp(TAG.source, "y");
  let lowerHtml: string | undefined;
  const lastCommentClose = html.lastIndexOf("-->");
  let last = 0;
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start === -1) {
      break;
    }
    let match: RegExpExecArray | null = null;
    if (html[start + 1] === "/") {
      // Closing tags fail within their name and trailing whitespace.
      tag.lastIndex = start;
      match = tag.exec(html);
      if (!match) {
        cursor = start + 1;
        continue;
      }
    } else {
      const end = tagCandidateEnd(html, start, lastCommentClose);
      if (end === -1) {
        break;
      }
      if (end === start) {
        cursor = start + 1;
        continue;
      }
      tag.lastIndex = 0;
      match = tag.exec(html.slice(start, end));
      if (!match) {
        cursor = end;
        continue;
      }
    }
    if (start > last) {
      yield { kind: "text", text: html.slice(last, start) };
    }
    last = start + match[0].length;
    cursor = last;
    const [, closeName, openName, rawAttrs, selfClosing] = match;
    if (closeName) {
      yield { kind: "close", name: closeName.toLowerCase() };
    } else if (openName) {
      const name = openName.toLowerCase();
      const isVoid = HTML_VOID_ELEMENTS.has(name) || selfClosing === "/";
      yield {
        kind: "open",
        name,
        attrs: parseAttributes(rawAttrs ?? ""),
        void: isVoid,
      };
      if (HTML_RAW_TEXT_ELEMENTS.has(name) && !isVoid) {
        lowerHtml ??= html.toLowerCase();
        const close = lowerHtml.indexOf(`</${name}`, last);
        const resume = close === -1 ? html.length : close;
        last = resume;
        cursor = resume;
      }
    }
  }
  if (last < html.length) {
    yield { kind: "text", text: html.slice(last) };
  }
}
