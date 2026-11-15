import {
  EMPTY_GEO_CHECK_GROUNDING,
  GEO_CHECK_GROUNDING_MAX_QUERIES,
  GEO_CHECK_GROUNDING_MAX_SOURCES,
} from "@notra/db/constants/geo-checks";
import type {
  GeoCheckGrounding,
  GeoCheckSource,
} from "@notra/db/types/geo-checks";
import { isRecord } from "@notra/utils/unknown-record";

import type { GeoGenerateTrace } from "../types/geo";
import { perplexitySourcesFromExcerpt } from "../utils/geo-perplexity-sources";
import { getReferenceDomain } from "../utils/reference-display";

/** Gemini grounding chunk kinds and the field each one keeps its URL in. */
const GROUNDING_CHUNK_URL_KEYS = [
  ["web", "uri"],
  ["image", "sourceUri"],
  ["retrievedContext", "uri"],
  ["maps", "uri"],
] as const;

function searchQueryOf(input: Record<string, unknown>): unknown {
  return input.query ?? input.q ?? input.search_query;
}

function addQuery(queries: string[], seen: Set<string>, value: unknown): void {
  if (typeof value !== "string") {
    return;
  }
  const query = value.trim();
  if (query.length === 0 || seen.has(query)) {
    return;
  }
  seen.add(query);
  queries.push(query);
}

function addSource(
  sources: GeoCheckSource[],
  seen: Set<string>,
  value: unknown
): void {
  if (!isRecord(value)) {
    return;
  }

  const url = typeof value.url === "string" ? value.url.trim() : "";
  const domain = getReferenceDomain(url);
  if (!domain || seen.has(url)) {
    return;
  }

  seen.add(url);
  const title =
    typeof value.title === "string" && value.title.trim().length > 0
      ? value.title.trim()
      : domain;
  sources.push({ title, url, domain });
}

function collectToolInputs(
  toolCalls: readonly unknown[] | undefined,
  queries: string[],
  seenQueries: Set<string>
): void {
  for (const call of toolCalls ?? []) {
    if (!isRecord(call)) {
      continue;
    }
    const input = call.input;
    if (!isRecord(input)) {
      continue;
    }
    addQuery(queries, seenQueries, searchQueryOf(input));
  }
}

function collectToolOutputs(
  toolResults: readonly unknown[] | undefined,
  queries: string[],
  seenQueries: Set<string>,
  sources: GeoCheckSource[],
  seenUrls: Set<string>
): void {
  for (const result of toolResults ?? []) {
    if (!isRecord(result)) {
      continue;
    }
    if (isRecord(result.input)) {
      addQuery(queries, seenQueries, searchQueryOf(result.input));
    }
    const output = result.output;
    const outputs = Array.isArray(output) ? output : [output];
    for (const item of outputs) {
      if (!isRecord(item)) {
        continue;
      }
      if (isRecord(item.action)) {
        addQuery(queries, seenQueries, item.action.query);
        for (const query of Array.isArray(item.action.queries)
          ? item.action.queries
          : []) {
          addQuery(queries, seenQueries, query);
        }
      }
      addQuery(queries, seenQueries, item.query);
      addSource(sources, seenUrls, item);

      const listed = item.sources ?? item.results;
      if (!Array.isArray(listed)) {
        continue;
      }
      for (const source of listed) {
        addSource(sources, seenUrls, source);
      }
    }
  }
}

function collectProviderMetadata(
  providerMetadata: unknown,
  queries: string[],
  seenQueries: Set<string>,
  sources: GeoCheckSource[],
  seenUrls: Set<string>
): void {
  if (!isRecord(providerMetadata)) {
    return;
  }

  for (const metadata of Object.values(providerMetadata)) {
    if (!isRecord(metadata) || !isRecord(metadata.groundingMetadata)) {
      continue;
    }
    const grounding = metadata.groundingMetadata;
    for (const query of Array.isArray(grounding.webSearchQueries)
      ? grounding.webSearchQueries
      : []) {
      addQuery(queries, seenQueries, query);
    }
    for (const chunk of Array.isArray(grounding.groundingChunks)
      ? grounding.groundingChunks
      : []) {
      if (!isRecord(chunk)) {
        continue;
      }
      for (const [kind, urlKey] of GROUNDING_CHUNK_URL_KEYS) {
        const entry = chunk[kind];
        if (isRecord(entry)) {
          addSource(sources, seenUrls, {
            title: entry.title,
            url: entry[urlKey],
          });
        }
      }
    }
  }
}

function collectTrace(
  trace: GeoGenerateTrace,
  queries: string[],
  seenQueries: Set<string>,
  sources: GeoCheckSource[],
  seenUrls: Set<string>
): void {
  for (const source of trace.sources ?? []) {
    addSource(sources, seenUrls, source);
  }
  collectToolInputs(trace.toolCalls, queries, seenQueries);
  collectToolOutputs(
    trace.toolResults,
    queries,
    seenQueries,
    sources,
    seenUrls
  );
  collectProviderMetadata(
    trace.providerMetadata,
    queries,
    seenQueries,
    sources,
    seenUrls
  );
}

export function extractGrounding(result: GeoGenerateTrace): GeoCheckGrounding {
  const queries: string[] = [];
  const sources: GeoCheckSource[] = [];
  const seenQueries = new Set<string>();
  const seenUrls = new Set<string>();

  collectTrace(result, queries, seenQueries, sources, seenUrls);

  for (const step of result.steps ?? []) {
    if (!isRecord(step)) {
      continue;
    }
    collectTrace(
      {
        sources: Array.isArray(step.sources) ? step.sources : undefined,
        toolCalls: Array.isArray(step.toolCalls) ? step.toolCalls : undefined,
        toolResults: Array.isArray(step.toolResults)
          ? step.toolResults
          : undefined,
        providerMetadata: step.providerMetadata,
      },
      queries,
      seenQueries,
      sources,
      seenUrls
    );
  }

  if (sources.length === 0 && typeof result.text === "string") {
    for (const source of perplexitySourcesFromExcerpt(result.text)) {
      addSource(sources, seenUrls, source);
    }
  }

  if (queries.length === 0 && sources.length === 0) {
    return EMPTY_GEO_CHECK_GROUNDING;
  }

  return {
    queries: queries.slice(0, GEO_CHECK_GROUNDING_MAX_QUERIES),
    sources: sources.slice(0, GEO_CHECK_GROUNDING_MAX_SOURCES),
  };
}
