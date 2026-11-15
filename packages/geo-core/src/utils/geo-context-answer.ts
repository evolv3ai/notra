import { Buffer } from "node:buffer";

import { DomUtils, parseDocument } from "htmlparser2";

import {
  GEO_CONTEXT_BLOCK_TAGS,
  GEO_CONTEXT_GOOGLE_ORIGIN,
  GEO_CONTEXT_IGNORED_TAGS,
  GEO_CONTEXT_MAX_HTML_BYTES,
} from "../constants/geo-context";
import type {
  GeoContextCapture,
  GeoContextElement,
  GeoContextEngine,
  GeoContextNode,
  GeoContextResponse,
} from "../types/geo-context";

function hasClass(element: GeoContextElement, name: string): boolean {
  return (element.attribs.class ?? "").split(/\s+/).includes(name);
}

function hidden(element: GeoContextElement): boolean {
  // Google's `ahbak` blocks contain the answer beyond its collapsed preview.
  return (
    "hidden" in element.attribs ||
    "inert" in element.attribs ||
    (element.attribs["aria-hidden"] === "true" &&
      !("ahbak" in element.attribs)) ||
    /display\s*:\s*none/i.test(element.attribs.style ?? "")
  );
}

function render(node: GeoContextNode): string {
  if (node.type === "text") {
    return node.data;
  }
  if (
    node.type !== "tag" ||
    hidden(node) ||
    GEO_CONTEXT_IGNORED_TAGS.has(node.name)
  ) {
    return "";
  }
  const text = node.children.map(render).join("");
  if (node.name === "td" || node.name === "th") {
    return `${text}\t`;
  }
  return GEO_CONTEXT_BLOCK_TAGS.has(node.name) ? `\n${text}\n` : text;
}

function textOf(node: GeoContextElement): string {
  return render(node)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function geoContextSourceUrl(value: string): string | null {
  if (value.length > 8192) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes(".") ||
      url.hostname.endsWith(".") ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.startsWith("[") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(
        url.hostname
      )
    ) {
      return null;
    }
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function metadataUrls(value: unknown): string[] {
  if (typeof value === "string") {
    const url = geoContextSourceUrl(value);
    return url ? [url] : [];
  }
  return Array.isArray(value) ? value.flatMap(metadataUrls) : [];
}

function geminiCapture(
  document: ReturnType<typeof parseDocument>,
  prompt: string
): GeoContextCapture {
  const queries = DomUtils.findAll(
    (element) => element.name === "user-query",
    document.children
  );
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  if (
    queries.length !== 1 ||
    !queries.some((query) => {
      const lines = DomUtils.findAll(
        (element) => hasClass(element, "query-text-line"),
        query.children
      );
      return (
        normalize(lines.map((line) => DomUtils.innerText(line)).join("\n")) ===
        normalize(prompt)
      );
    })
  ) {
    throw new Error("Gemini did not submit the requested prompt");
  }
  const responses = DomUtils.findAll(
    (element) =>
      (element.attribs.id ?? "").startsWith("model-response-message-content") &&
      !hidden(element),
    document.children
  );
  if (
    responses.length !== 1 ||
    responses[0]?.attribs["aria-busy"] !== "false"
  ) {
    throw new Error(
      "Gemini response is missing, ambiguous, or still generating"
    );
  }
  const root = responses[0];
  const chips = DomUtils.findAll(
    (element) => element.name === "source-inline-chip",
    root.children
  );
  const sources = chips.flatMap((chip) => {
    const buttons = DomUtils.findAll(
      (element) => element.name === "button",
      chip.children
    );
    const urls = buttons.flatMap((button) => {
      const encoded = /BardVeMetadataKey:([A-Za-z0-9_+/=-]+)/.exec(
        button.attribs.jslog ?? ""
      )?.[1];
      if (!encoded) {
        return [];
      }
      try {
        return metadataUrls(
          JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))
        );
      } catch {
        return [];
      }
    });
    if (urls.length === 0) {
      throw new Error("Gemini citation metadata is missing or invalid");
    }
    const title = DomUtils.innerText(chip).trim();
    return urls.map((url) => ({ url, title: title || new URL(url).hostname }));
  });
  return { text: textOf(root), sources, absent: false };
}

function overviewCapture(
  document: ReturnType<typeof parseDocument>
): GeoContextCapture {
  const search = DomUtils.findOne(
    (element) => element.attribs.id === "search",
    document.children,
    true
  );
  const roots = DomUtils.findAll(
    (element) => element.attribs["data-subtree"] === "aimc",
    document.children
  );
  const organic = DomUtils.findOne(
    (element) =>
      "data-snhf" in element.attribs ||
      (element.name === "a" &&
        Boolean(
          DomUtils.findOne(
            (child) => child.name === "h3",
            element.children,
            true
          )
        )),
    search?.children ?? [],
    true
  );
  const root = roots.find(
    (element) =>
      !organic || (element.startIndex ?? Infinity) < (organic.startIndex ?? 0)
  );
  if (!root) {
    const loading = DomUtils.findOne(
      (element) =>
        element.attribs.role === "progressbar" ||
        element.attribs["aria-busy"] === "true",
      search?.children ?? [],
      true
    );
    if (!search || !organic || loading || roots.length > 0) {
      throw new Error(
        "Google did not return a verifiable completed search page"
      );
    }
    return { text: "", sources: [], absent: true };
  }
  const main = DomUtils.findOne(
    (element) => element.attribs["data-container-id"] === "main-col",
    root.children,
    true
  );
  if (!main) {
    throw new Error("Google AI Overview answer container is missing");
  }
  const collapsed = DomUtils.findOne(
    (element) =>
      !hidden(element) &&
      /^(?:show more|mehr anzeigen)$/i.test(
        element.attribs["aria-label"] ??
          (element.name === "button" || element.attribs.role === "button"
            ? DomUtils.innerText(element).trim()
            : "")
      ),
    root.children,
    true
  );
  if (
    collapsed ||
    DomUtils.findOne(
      (element) => element.attribs["aria-busy"] === "true",
      root.children,
      true
    )
  ) {
    throw new Error("Google AI Overview is collapsed or still generating");
  }
  const sourceRoots = DomUtils.findAll(
    (element) =>
      ["main-col", "rhs-col"].includes(
        element.attribs["data-container-id"] ?? ""
      ),
    root.children
  );
  const sources = sourceRoots
    .flatMap((sourceRoot) =>
      DomUtils.findAll(
        (element) => element.name === "a" && Boolean(element.attribs.href),
        sourceRoot.children
      )
    )
    .flatMap((element) => {
      const raw = element.attribs.href ?? "";
      const url = geoContextSourceUrl(
        new URL(raw, GEO_CONTEXT_GOOGLE_ORIGIN).href
      );
      if (!url) {
        return [];
      }
      const parsed = new URL(url);
      if (
        parsed.hostname === "www.google.com" &&
        !["/goto", "/url"].includes(parsed.pathname)
      ) {
        return [];
      }
      return [
        {
          url,
          title:
            element.attribs["aria-label"] ??
            (DomUtils.innerText(element).trim() || parsed.hostname),
        },
      ];
    });
  return { text: textOf(main), sources, absent: false };
}

/** Only answer DOM and its citation metadata are evidence; never the whole page. */
export function parseGeoContextCapture(
  engine: GeoContextEngine,
  prompt: string,
  response: GeoContextResponse
): GeoContextCapture {
  if (
    !response.html.requested ||
    response.html.success !== true ||
    !response.html.data ||
    Buffer.byteLength(response.html.data) > GEO_CONTEXT_MAX_HTML_BYTES
  ) {
    throw new Error("Context returned no usable rendered HTML");
  }
  const url = new URL(response.url);
  const expected =
    engine === "google/gemini" ? "gemini.google.com" : "www.google.com";
  if (
    url.protocol !== "https:" ||
    url.hostname !== expected ||
    url.username ||
    url.password ||
    url.port ||
    (engine === "google/ai-overview" && url.pathname !== "/search")
  ) {
    throw new Error("Context ended on an unexpected surface");
  }
  const document = parseDocument(response.html.data, {
    withStartIndices: true,
  });
  if (engine === "google/ai-overview" && url.searchParams.get("q") !== prompt) {
    throw new Error("Google returned a different query");
  }
  // Challenge state, not prose: legitimate prompts and answers can discuss CAPTCHAs.
  const challenge = DomUtils.findOne(
    (element) =>
      !hidden(element) &&
      element.name === "form" &&
      (element.attribs.id === "captcha-form" ||
        new URL(element.attribs.action ?? "", url).pathname.startsWith(
          "/sorry/"
        )),
    document.children,
    true
  );
  if (challenge) {
    throw new Error("Context captured a challenge instead of an answer");
  }
  const result =
    engine === "google/gemini"
      ? geminiCapture(document, prompt)
      : overviewCapture(document);
  if (
    !result.absent &&
    (result.text.length < 80 || result.sources.length === 0)
  ) {
    throw new Error(
      "Context answer is empty, incomplete, or missing citations"
    );
  }
  const unique = new Map(result.sources.map((source) => [source.url, source]));
  return { ...result, sources: [...unique.values()] };
}
