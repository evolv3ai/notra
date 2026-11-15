import { trackedPromptScanId } from "@notra/geo-core/geo/prompts";
import type {
  GeoPresenceStatus,
  GeoPromptResultSummary,
  GeoTrackedPrompt,
} from "@notra/geo-core/types/geo";
import { engineFamilyOf } from "@notra/geo-core/utils/geo-engine-family";
import { summarizePromptResults } from "@notra/geo-core/utils/geo-presence";
import { geoPromptIntent } from "@notra/geo-core/utils/geo-prompt-intent";
import { GEO_PROMPT_FILTER_ALL } from "@notra/schemas/constants/dashboard/geo-prompts";

import type {
  EngineFamilyPromptHit,
  GeoLostPromptRow,
  GeoPromptBrandCount,
  GeoPromptCoverage,
  GeoPromptTableFilters,
  GeoPromptTableRow,
} from "@/types/geo";
import { bestFuzzyScore, fuzzyMatches } from "@/utils/fuzzy";
import { uniquePromptBrandNames } from "@/utils/geo-prompt-brands";
const PRESENCE_SORT_VALUE: Record<GeoPresenceStatus, number> = {
  "training-data": 3,
  "retrieval-only": 2,
  invisible: 1,
};

export function promptPresenceSortValue(
  status: GeoPresenceStatus | null
): number {
  if (!status) {
    return 0;
  }
  return PRESENCE_SORT_VALUE[status];
}

function matchesPromptFilters(
  prompt: GeoTrackedPrompt,
  intent: GeoPromptTableRow["intent"],
  filters: GeoPromptTableFilters
): boolean {
  if (
    filters.source !== GEO_PROMPT_FILTER_ALL &&
    prompt.source !== filters.source
  ) {
    return false;
  }
  if (filters.intent !== GEO_PROMPT_FILTER_ALL && intent !== filters.intent) {
    return false;
  }
  if (
    filters.tag !== GEO_PROMPT_FILTER_ALL &&
    !prompt.tags.includes(filters.tag)
  ) {
    return false;
  }
  return fuzzyMatches([prompt.prompt, ...prompt.tags], filters.q.trim());
}

export function buildPromptTableRows(
  prompts: readonly GeoTrackedPrompt[],
  results: readonly GeoPromptResultSummary[],
  filters: GeoPromptTableFilters
): GeoPromptTableRow[] {
  const summaries = new Map(
    summarizePromptResults([...results]).map((summary) => [
      summary.promptId,
      summary,
    ])
  );
  const query = filters.q.trim();
  const rows: GeoPromptTableRow[] = [];

  for (const prompt of prompts) {
    const intent = geoPromptIntent(prompt.prompt);
    if (!matchesPromptFilters(prompt, intent, filters)) {
      continue;
    }
    const summary = summaries.get(trackedPromptScanId(prompt));
    rows.push({
      id: prompt.id,
      prompt: prompt.prompt,
      enabled: prompt.enabled,
      source: prompt.source,
      tags: prompt.tags,
      intent,
      mentioned: summary?.mentioned ?? 0,
      total: summary?.total ?? 0,
      bestPosition: summary?.bestPosition ?? null,
      presence: summary?.presence ?? null,
      results: summary?.results ?? [],
    });
  }

  if (query.length === 0) {
    return rows;
  }

  return rows
    .map((row) => ({
      row,
      score: bestFuzzyScore([row.prompt, ...row.tags], query),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.row);
}

function bestMentionedResult(
  results: readonly GeoPromptResultSummary[]
): GeoPromptResultSummary | null {
  let best: GeoPromptResultSummary | null = null;
  for (const result of results) {
    if (!result.mentioned) {
      continue;
    }
    if (
      best === null ||
      (result.position ?? Number.MAX_SAFE_INTEGER) <
        (best.position ?? Number.MAX_SAFE_INTEGER)
    ) {
      best = result;
    }
  }
  return best;
}

export function engineFamilyPromptHits(
  family: string,
  results: readonly GeoPromptResultSummary[]
): EngineFamilyPromptHit[] {
  const byPrompt = new Map<string, GeoPromptResultSummary[]>();
  for (const result of results) {
    if (engineFamilyOf(result.engine) !== family) {
      continue;
    }
    const group = byPrompt.get(result.promptId) ?? [];
    group.push(result);
    byPrompt.set(result.promptId, group);
  }

  const rows: EngineFamilyPromptHit[] = [];
  for (const [promptId, group] of byPrompt) {
    const mentioned = bestMentionedResult(group);
    const first = group[0];
    if (!first) {
      continue;
    }
    rows.push({
      promptId,
      prompt: first.prompt,
      mentioned: mentioned !== null,
      ownedSourceCited: group.some((result) => result.ownedSourceCited),
      position: mentioned?.position ?? null,
    });
  }

  return rows.sort((left, right) => {
    if (left.mentioned !== right.mentioned) {
      return left.mentioned ? 1 : -1;
    }
    if (left.position === null && right.position === null) {
      return left.prompt.localeCompare(right.prompt);
    }
    if (left.position === null) {
      return 1;
    }
    if (right.position === null) {
      return -1;
    }
    return left.position - right.position;
  });
}

/**
 * Share of the enabled tracked prompts whose latest answer on the engine family
 * shows the brand. Paused or removed prompts drop out, and enabled prompts the
 * engine has not answered yet count as not visible. Without a prompt list
 * (`null`, e.g. design-system fixtures) the answered prompts stand in for it.
 */
export function engineFamilyPromptCoverage(
  hits: readonly EngineFamilyPromptHit[],
  trackedPrompts: readonly GeoTrackedPrompt[] | null
): GeoPromptCoverage | null {
  const isVisible = (hit: EngineFamilyPromptHit) =>
    hit.mentioned || Boolean(hit.ownedSourceCited);
  if (trackedPrompts === null) {
    if (hits.length === 0) {
      return null;
    }
    const visible = hits.filter(isVisible).length;
    return {
      mentioned: visible,
      total: hits.length,
      rate: visible / hits.length,
    };
  }
  const enabledScanIds = new Set(
    trackedPrompts
      .filter((prompt) => prompt.enabled)
      .map((prompt) => trackedPromptScanId(prompt))
  );
  if (enabledScanIds.size === 0) {
    return null;
  }
  const visible = hits.filter(
    (hit) => enabledScanIds.has(hit.promptId) && isVisible(hit)
  ).length;
  return {
    mentioned: visible,
    total: enabledScanIds.size,
    rate: visible / enabledScanIds.size,
  };
}

export function promptTableRowForId(
  promptId: string,
  results: readonly GeoPromptResultSummary[]
): GeoPromptTableRow | null {
  const group = results.filter((result) => result.promptId === promptId);
  const first = group[0];
  if (!first) {
    return null;
  }
  const mentioned = group.filter((result) => result.mentioned);
  const best = bestMentionedResult(group);
  return {
    id: promptId,
    prompt: first.prompt,
    enabled: true,
    source: "auto",
    tags: [],
    intent: geoPromptIntent(first.prompt),
    mentioned: mentioned.length,
    total: group.length,
    bestPosition: best?.position ?? null,
    presence: null,
    results: group,
  };
}

/**
 * Brands the engines named on a prompt instead of yours, most named first.
 * `count` is how many answers named the brand.
 */
export function promptMentionedInstead(
  results: readonly GeoPromptResultSummary[]
): GeoPromptBrandCount[] {
  const counts = new Map<string, number>();
  for (const result of results) {
    for (const name of uniquePromptBrandNames(result.competitors)) {
      if (name) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Prompts where an answer named a competitor but not you, most lost answers
 * first.
 */
export function buildLostPromptRows(
  results: readonly GeoPromptResultSummary[]
): GeoLostPromptRow[] {
  const byPrompt = new Map<string, GeoPromptResultSummary[]>();
  for (const result of results) {
    const group = byPrompt.get(result.promptId) ?? [];
    group.push(result);
    byPrompt.set(result.promptId, group);
  }
  const rows: GeoLostPromptRow[] = [];
  for (const [promptId, group] of byPrompt) {
    const lostResults = group.filter(
      (result) =>
        !result.mentioned &&
        uniquePromptBrandNames(result.competitors).length > 0
    );
    if (lostResults.length === 0) {
      continue;
    }
    rows.push({
      promptId,
      prompt: group[0]?.prompt ?? "",
      answers: group.length,
      lost: lostResults.length,
      lostEngines: [
        ...new Set(lostResults.map((result) => engineFamilyOf(result.engine))),
      ],
      brands: promptMentionedInstead(lostResults),
    });
  }
  return rows.sort(
    (a, b) =>
      b.lost - a.lost ||
      b.lost / b.answers - a.lost / a.answers ||
      a.prompt.localeCompare(b.prompt)
  );
}
