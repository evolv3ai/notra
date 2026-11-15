import {
  COMMAND_PALETTE_ENTITY_ICONS,
  COMMAND_PALETTE_NAME_MATCH_MIN_LENGTH,
  COMMAND_PALETTE_SEARCH_MIN_LENGTH,
  COMMAND_ROUTES,
} from "@/constants/command-palette";
import { GEO_PERSONA_DETAIL_QUERY_KEY } from "@/constants/geo-personas";
import { GEO_PROMPT_DETAIL_QUERY_KEY } from "@/constants/geo-prompts";
import type {
  CommandPaletteEntityTarget,
  CommandPaletteNavigationEntity,
  CommandRoute,
} from "@/types/components/command-palette";
import type { NavVisibility } from "@/types/components/nav";
import { geoCompetitorDetailPath } from "@/utils/geo-competitors";

export function isCommandPaletteSearchPending(
  query: string,
  debouncedQuery: string,
  isWaitingForResults: boolean
): boolean {
  const trimmedQuery = query.trim();
  return (
    trimmedQuery.length >= COMMAND_PALETTE_SEARCH_MIN_LENGTH &&
    (trimmedQuery !== debouncedQuery || isWaitingForResults)
  );
}

export function isCommandRouteAvailable(
  route: CommandRoute,
  hasAiCredits: boolean
): boolean {
  return !route.requiresAiCredits || hasAiCredits;
}

export function isCommandRouteVisible(
  route: CommandRoute,
  visibility: NavVisibility
): boolean {
  return !route.flag || visibility[route.flag];
}

export function commandRoutesForAI(
  slug: string,
  hasAiCredits: boolean,
  visibility: NavVisibility
) {
  return COMMAND_ROUTES.filter(
    (r) =>
      isCommandRouteAvailable(r, hasAiCredits) &&
      isCommandRouteVisible(r, visibility)
  ).map((r) => ({
    id: r.id,
    label: r.label,
    section: r.section,
    path: r.path(slug),
    keywords: r.keywords,
  }));
}

/** Where a palette search hit opens; shared by the list and the AI router. */
export function commandPaletteEntityPath(
  slug: string,
  target: CommandPaletteEntityTarget
): string {
  const id = encodeURIComponent(target.id);
  switch (target.kind) {
    case "post":
      return `/${slug}/content/${id}`;
    case "voice":
    case "reference":
      return `/${slug}/brand/identity`;
    case "github":
      return `/${slug}/integrations/github/${id}`;
    case "linear":
      return `/${slug}/integrations/linear/${id}`;
    case "social":
      return `/${slug}/integrations`;
    case "prompt":
      return `/${slug}/geo/prompts?${GEO_PROMPT_DETAIL_QUERY_KEY}=${id}`;
    case "competitor":
      return geoCompetitorDetailPath(slug, target.name);
    case "persona":
      return `/${slug}/geo/personas?${GEO_PERSONA_DETAIL_QUERY_KEY}=${id}`;
    case "site":
      return `/${slug}/sites/${id}`;
    case "chat":
      return `/${slug}/chat/${id}`;
    default:
      return `/${slug}`;
  }
}

/** The single hit whose name starts with `query`, if there is exactly one. */
export function findNameMatch(
  query: string,
  entities: readonly CommandPaletteNavigationEntity[]
): CommandPaletteNavigationEntity | null {
  const needle = query.trim().toLowerCase();
  if (needle.length < COMMAND_PALETTE_NAME_MATCH_MIN_LENGTH) {
    return null;
  }
  const matches = entities.filter((entity) =>
    entity.label.toLowerCase().startsWith(needle)
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

const WORD_SPLIT_PATTERN = /[^\p{L}\p{N}]+/u;
const ENTITY_VALUE_PATTERN = new RegExp(
  `^(${Object.keys(COMMAND_PALETTE_ENTITY_ICONS).join("|")}):`
);

function words(text: string): string[] {
  return text.toLowerCase().split(WORD_SPLIT_PATTERN).filter(Boolean);
}

/**
 * cmdk filter: every search word has to start a word of the label or its
 * keywords. cmdk's default fuzzy score matches letters across words, so
 * "roadmap" used to surface "Brand". Search hits are already matched on the
 * server and always pass.
 */
export function commandPaletteFilter(
  value: string,
  search: string,
  keywords?: string[]
): number {
  if (ENTITY_VALUE_PATTERN.test(value)) {
    return 1;
  }
  const needles = words(search);
  if (needles.length === 0) {
    return 1;
  }
  const label = value.split("__")[0] ?? value;
  const labelWords = words(label);
  const keywordWords = words((keywords ?? []).join(" "));
  const startsWord = (pool: string[]) =>
    needles.every((needle) => pool.some((word) => word.startsWith(needle)));
  if (startsWord(labelWords)) {
    return label.toLowerCase().startsWith(needles[0] ?? "") ? 1 : 0.8;
  }
  return startsWord([...labelWords, ...keywordWords]) ? 0.5 : 0;
}
