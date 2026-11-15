import type { GscQueryRow } from "@notra/ai/types/google-search-console";
import { escapeRegExp } from "@notra/utils/escape";

import {
  GSC_QUERY_CLUSTER_CAP,
  GSC_QUERY_CLUSTER_WORDS,
  GSC_QUESTION_MIN_IMPRESSIONS,
  GSC_SYNC_MAX_KEYWORDS_FOR_MODEL,
  GSC_SYNC_MAX_QUESTIONS_FOR_MODEL,
  GSC_SYNC_MIN_IMPRESSIONS,
} from "../constants/google-search-console";
import type { GeoSuggestionKeyword } from "../types/geo";
import { isQuestionQuery } from "../utils/gsc-question";

const MIN_BRAND_TERM_LENGTH = 3;
const BRAND_TOKEN_SEPARATOR = "[-_\\s]+";
/*
 * `\b` counts only [A-Za-z0-9_] as word characters, so a brand that starts or
 * ends on a non-ASCII letter never gets a boundary there and survives the
 * strip — "Nestlé" and "ブランド" did, while "Müller" happened to work because
 * its umlaut sits between two ASCII letters. Same class the answer mention
 * matcher uses; marks are included so a stray combining mark cannot split a
 * letter from its accent.
 */
const BRAND_WORD_CHAR = "[\\p{L}\\p{N}\\p{M}_]";
const NAVIGATIONAL_QUERY =
  /^(?:[\p{L}\p{N}._-]+\s+){0,2}(?:log(?:in|\s+in|-in)|sign(?:\s+|-)?(?:in|up)|anmelden|einloggen|careers|karriere|stellenangebote|impressum)$/iu;
const WINNING_POSITION = 3;
const STRIKING_POSITION = 20;
const WEAK_POSITION = 40;
const WINNING_WEIGHT = 0.02;
const STRIKING_WEIGHT = 1;
const WEAK_WEIGHT = 0.6;
const DISTANT_WEIGHT = 0.25;
const CTR_SATURATION = 0.5;

export function normalizeSuggestionKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeForBrandMatch(value: string): string {
  return normalizeSuggestionKey(value.normalize("NFC"))
    .replace(/[-_]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function promptMentionsBrand(
  text: string,
  brandTerms: string[]
): boolean {
  const normalized = ` ${normalizeForBrandMatch(text)} `;
  return brandTerms.some((term) =>
    normalized.includes(` ${normalizeForBrandMatch(term)} `)
  );
}

export function stripBrandTerms(text: string, brandTerms: string[]): string {
  let result = text.normalize("NFC");
  const sorted = [...brandTerms].sort(
    (left, right) => right.length - left.length
  );
  for (const term of sorted) {
    const folded = normalizeForBrandMatch(term);
    if (folded.length === 0) {
      continue;
    }
    const parts = folded.split(" ").filter(Boolean).map(escapeRegExp);
    if (parts.length === 0) {
      continue;
    }
    result = result.replace(
      new RegExp(
        `(?<!${BRAND_WORD_CHAR})${parts.join(BRAND_TOKEN_SEPARATOR)}(?!${BRAND_WORD_CHAR})`,
        "giu"
      ),
      " "
    );
  }
  return result.replace(/\s+/g, " ").trim();
}

export function buildBrandTerms(
  settings: { companyName: string; aliases: string[] } | null | undefined
): string[] {
  if (!settings) {
    return [];
  }
  return [settings.companyName, ...settings.aliases].flatMap((value) => {
    const term = normalizeSuggestionKey(value);
    return term.length >= MIN_BRAND_TERM_LENGTH ? [term] : [];
  });
}

export function isNavigationalQuery(query: string): boolean {
  return NAVIGATIONAL_QUERY.test(query);
}

function opportunityScore(row: GscQueryRow): number {
  const ctr =
    row.impressions > 0
      ? Math.min(row.clicks / row.impressions, CTR_SATURATION)
      : 0;
  let weight = DISTANT_WEIGHT;
  if (row.position <= WINNING_POSITION) {
    weight = WINNING_WEIGHT;
  } else if (row.position <= STRIKING_POSITION) {
    weight = STRIKING_WEIGHT;
  } else if (row.position <= WEAK_POSITION) {
    weight = WEAK_WEIGHT;
  }
  return row.impressions * weight * (1 - ctr);
}

function clusterKey(query: string): string {
  return normalizeSuggestionKey(query)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, GSC_QUERY_CLUSTER_WORDS)
    .join(" ");
}

/** Both pulls can return the same query; the first row wins. */
export function mergeQueryRows(
  ...sources: readonly GscQueryRow[][]
): GscQueryRow[] {
  const byQuery = new Map<string, GscQueryRow>();
  for (const row of sources.flat()) {
    const key = normalizeSuggestionKey(row.query);
    if (!byQuery.has(key)) {
      byQuery.set(key, row);
    }
  }
  return [...byQuery.values()];
}

/**
 * Ranks queries the site shows up for but does not win. Google's own response
 * is click-sorted, so a page already at position 1 would otherwise fill the
 * prompt budget and the actual gaps never reach the model. Questions get
 * their own slots first: they are long tail and would lose on volume, yet
 * they are already worded like a prompt.
 */
export function selectKeywordsForModel(
  rows: GscQueryRow[],
  brandTerms: string[]
): GscQueryRow[] {
  const ranked = rows
    .filter(
      (row) =>
        row.impressions >=
          (isQuestionQuery(row.query)
            ? GSC_QUESTION_MIN_IMPRESSIONS
            : GSC_SYNC_MIN_IMPRESSIONS) &&
        !promptMentionsBrand(row.query, brandTerms) &&
        !isNavigationalQuery(row.query)
    )
    .sort(
      (left, right) =>
        opportunityScore(right) - opportunityScore(left) ||
        right.impressions - left.impressions
    );

  const picked = new Set<GscQueryRow>();
  for (const row of ranked) {
    if (picked.size >= GSC_SYNC_MAX_QUESTIONS_FOR_MODEL) {
      break;
    }
    // No clustering: "how do i …" questions share their opener, not their intent.
    if (isQuestionQuery(row.query)) {
      picked.add(row);
    }
  }

  const perCluster = new Map<string, number>();
  for (const row of ranked) {
    if (picked.size >= GSC_SYNC_MAX_KEYWORDS_FOR_MODEL) {
      break;
    }
    // Questions past their quota stay out, so head terms keep the rest.
    if (picked.has(row) || isQuestionQuery(row.query)) {
      continue;
    }
    const key = clusterKey(row.query);
    const count = perCluster.get(key) ?? 0;
    if (count >= GSC_QUERY_CLUSTER_CAP) {
      continue;
    }
    perCluster.set(key, count + 1);
    picked.add(row);
  }
  return ranked.filter((row) => picked.has(row));
}

/**
 * `used` is shared across all entries of one sync so a source query backs at
 * most one suggestion. Otherwise the model spreads one keyword cluster over
 * several near-identical prompts and their impressions get counted repeatedly.
 */
export function resolveSourceKeywords(
  claimed: string[],
  keywordByQuery: Map<string, GscQueryRow>,
  used: Set<string>
): GeoSuggestionKeyword[] {
  const sourceKeywords: GeoSuggestionKeyword[] = [];
  for (const keyword of claimed) {
    const key = normalizeSuggestionKey(keyword);
    const match = keywordByQuery.get(key);
    if (match && !used.has(key)) {
      used.add(key);
      sourceKeywords.push({
        query: match.query,
        clicks: match.clicks,
        impressions: match.impressions,
        position: Number(match.position.toFixed(1)),
      });
    }
  }
  return sourceKeywords;
}
