import { fromMarkdown } from "mdast-util-from-markdown";

import {
  CONTEXT_REPORT_ENGINES,
  OLOSTEP_REPORT_ENGINES,
  REPORT_CAPTURE_METHOD,
} from "../constants/collection";
import {
  ENGINE_MODELS,
  type RawAnswer,
  type RawSource,
  type ReportEngine,
} from "../shared";

/** Count exact Markdown link destinations, not searched URLs or URL prefixes. */
export function reportCitedSources(
  sources: RawSource[],
  text: string
): RawSource[] {
  const links = new Set<string>();
  const references = new Set<string>();
  const definitions = new Map<string, string>();
  const nodes = [...fromMarkdown(text).children].reverse();
  while (nodes.length > 0) {
    const node = nodes.pop();
    if (!node) {
      continue;
    }
    if (node.type === "link") {
      links.add(node.url);
    } else if (node.type === "linkReference") {
      references.add(node.identifier);
    } else if (
      node.type === "definition" &&
      !definitions.has(node.identifier)
    ) {
      definitions.set(node.identifier, node.url);
    }
    if ("children" in node) {
      nodes.push(...node.children.toReversed());
    }
  }
  for (const reference of references) {
    const url = definitions.get(reference);
    if (url) {
      links.add(url);
    }
  }
  return sources.filter((source) => links.has(source.url));
}

export function reportCollectionModel(engine: ReportEngine): string {
  return (
    OLOSTEP_REPORT_ENGINES[engine] ??
    CONTEXT_REPORT_ENGINES[engine] ??
    ENGINE_MODELS[engine]
  );
}

export function assertReportCapture(answer: RawAnswer): void {
  if (
    answer.captureMethod !== REPORT_CAPTURE_METHOD ||
    answer.model !== reportCollectionModel(answer.engine)
  ) {
    throw new Error(
      "Existing answers use a different collection method/model. Use a fresh SOAS_EDITION or SOAS_RAW_ROOT; do not mix API and consumer-app captures."
    );
  }
}

/** Historical reports remain buildable, but never combine methods/models. */
export function reportAnswerModel(answers: RawAnswer[]): string {
  const variants = new Set(
    answers.map(
      (answer) => `${answer.captureMethod ?? "legacy-api"}:${answer.model}`
    )
  );
  if (variants.size !== 1 || !answers[0]) {
    throw new Error(
      "Cannot publish mixed capture methods/models for one engine"
    );
  }
  return answers[0].model;
}
