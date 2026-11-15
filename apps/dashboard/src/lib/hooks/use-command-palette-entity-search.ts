"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import {
  COMMAND_PALETTE_ENTITY_ICONS,
  COMMAND_PALETTE_REFERENCE_SNIPPET_MAX,
  COMMAND_PALETTE_SEARCH_DEBOUNCE_MS,
  COMMAND_PALETTE_SEARCH_MIN_LENGTH,
} from "@/constants/command-palette";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  CommandPaletteEntitySearchResult,
  CommandPaletteSearchData,
  CommandPaletteTranslator,
  EntityHit,
  EntityHitSection,
  EntityHitsBySection,
  UseCommandPaletteEntitySearchParams,
} from "@/types/components/command-palette";
import type { CommonTranslator } from "@/types/i18n";
import {
  commandPaletteEntityPath,
  isCommandPaletteSearchPending,
} from "@/utils/command-palette";
import { truncateSnippet } from "@/utils/format";

const URL_PROTOCOL_PATTERN = /^https?:\/\//;

const REFERENCE_TYPE_BRAND_LABEL: Record<string, string> = {
  twitter_post: "Twitter",
  linkedin_post: "LinkedIn",
};

const ENTITY_SECTION_BY_KIND = {
  prompt: "prompts",
  competitor: "competitors",
  persona: "personas",
  post: "posts",
  chat: "chats",
  site: "sites",
  voice: "brandVoices",
  reference: "references",
  github: "integrations",
  linear: "integrations",
  social: "integrations",
} as const satisfies Record<EntityHit["kind"], EntityHitSection>;

function referenceTypeLabel(
  type: string,
  t: CommandPaletteTranslator,
  tCommon: CommonTranslator
): string {
  const brandLabel = REFERENCE_TYPE_BRAND_LABEL[type];
  if (brandLabel) {
    return brandLabel;
  }
  if (type === "blog_post") {
    return tCommon("labels.blog");
  }
  if (type === "custom") {
    return tCommon("labels.customOwn");
  }
  return t("entities.reference");
}

function collectEntityHits(
  data: CommandPaletteSearchData | undefined,
  slug: string,
  isProjectResolved: boolean,
  debouncedQuery: string,
  t: CommandPaletteTranslator,
  tCommon: CommonTranslator
): EntityHit[] {
  if (!(data && slug && isProjectResolved)) {
    return [];
  }
  const hits: EntityHit[] = [];
  for (const post of data.posts) {
    hits.push({
      key: `post:${post.id}`,
      kind: "post",
      label: post.title,
      sublabel:
        post.status === "published"
          ? tCommon("labels.published")
          : tCommon("labels.draft"),
      icon: COMMAND_PALETTE_ENTITY_ICONS.post,
      path: commandPaletteEntityPath(slug, {
        kind: "post",
        id: post.id,
        name: post.title,
      }),
      keywords: ["post", "content", post.slug ?? "", debouncedQuery],
    });
  }
  for (const voice of data.voices) {
    const parts = [voice.companyName, voice.websiteUrl]
      .filter(Boolean)
      .join(" · ");
    hits.push({
      key: `voice:${voice.id}`,
      kind: "voice",
      label: voice.name,
      sublabel: parts || tCommon("labels.brandVoice"),
      icon: COMMAND_PALETTE_ENTITY_ICONS.voice,
      path: commandPaletteEntityPath(slug, {
        kind: "voice",
        id: voice.id,
        name: voice.name,
      }),
      keywords: [
        "brand",
        "voice",
        "identity",
        voice.websiteUrl ?? "",
        debouncedQuery,
      ],
    });
  }
  for (const reference of data.references) {
    const typeLabel = referenceTypeLabel(reference.type, t, tCommon);
    hits.push({
      key: `reference:${reference.id}`,
      kind: "reference",
      label: truncateSnippet(
        reference.content,
        COMMAND_PALETTE_REFERENCE_SNIPPET_MAX
      ),
      sublabel: reference.note
        ? `${typeLabel} · ${truncateSnippet(reference.note, 40)}`
        : typeLabel,
      icon: COMMAND_PALETTE_ENTITY_ICONS.reference,
      path: commandPaletteEntityPath(slug, {
        kind: "reference",
        id: reference.id,
        name: reference.content,
      }),
      keywords: ["reference", "brand", typeLabel.toLowerCase(), debouncedQuery],
    });
  }
  for (const integration of data.githubIntegrations) {
    const repoLabel =
      integration.owner && integration.repo
        ? `${integration.owner}/${integration.repo}`
        : undefined;
    hits.push({
      key: `github:${integration.id}`,
      kind: "github",
      label: integration.displayName,
      sublabel: repoLabel ? `GitHub · ${repoLabel}` : "GitHub",
      icon: COMMAND_PALETTE_ENTITY_ICONS.github,
      path: commandPaletteEntityPath(slug, {
        kind: "github",
        id: integration.id,
        name: integration.displayName,
      }),
      keywords: ["github", "integration", repoLabel ?? "", debouncedQuery],
    });
  }
  for (const integration of data.linearIntegrations) {
    const sub = [integration.linearOrganizationName, integration.linearTeamName]
      .filter(Boolean)
      .join(" · ");
    hits.push({
      key: `linear:${integration.id}`,
      kind: "linear",
      label: integration.displayName,
      sublabel: sub ? `Linear · ${sub}` : "Linear",
      icon: COMMAND_PALETTE_ENTITY_ICONS.linear,
      path: commandPaletteEntityPath(slug, {
        kind: "linear",
        id: integration.id,
        name: integration.displayName,
      }),
      keywords: ["linear", "integration", debouncedQuery],
    });
  }
  for (const account of data.socialAccounts) {
    hits.push({
      key: `social:${account.id}`,
      kind: "social",
      label: account.displayName,
      sublabel: `${account.provider} · @${account.username}`,
      icon: COMMAND_PALETTE_ENTITY_ICONS.social,
      path: commandPaletteEntityPath(slug, {
        kind: "social",
        id: account.id,
        name: account.displayName,
      }),
      keywords: [
        "social",
        "account",
        account.provider,
        account.username,
        debouncedQuery,
      ],
    });
  }
  for (const prompt of data.prompts) {
    hits.push({
      key: `prompt:${prompt.id}`,
      kind: "prompt",
      label: truncateSnippet(
        prompt.prompt,
        COMMAND_PALETTE_REFERENCE_SNIPPET_MAX
      ),
      sublabel:
        [prompt.enabled ? null : tCommon("labels.paused"), prompt.title]
          .filter(Boolean)
          .join(" · ") || undefined,
      icon: COMMAND_PALETTE_ENTITY_ICONS.prompt,
      path: commandPaletteEntityPath(slug, {
        kind: "prompt",
        id: prompt.id,
        name: prompt.prompt,
      }),
      keywords: ["prompt", "geo", prompt.title ?? "", debouncedQuery],
    });
  }
  for (const competitor of data.competitors) {
    hits.push({
      key: `competitor:${competitor.id}`,
      kind: "competitor",
      label: competitor.name,
      sublabel: competitor.domain ?? undefined,
      icon: COMMAND_PALETTE_ENTITY_ICONS.competitor,
      path: commandPaletteEntityPath(slug, {
        kind: "competitor",
        id: competitor.id,
        name: competitor.name,
      }),
      keywords: ["competitor", "geo", competitor.domain ?? "", debouncedQuery],
    });
  }
  for (const persona of data.personas) {
    hits.push({
      key: `persona:${persona.id}`,
      kind: "persona",
      label: persona.name,
      sublabel: [persona.role, persona.company].filter(Boolean).join(" · "),
      icon: COMMAND_PALETTE_ENTITY_ICONS.persona,
      path: commandPaletteEntityPath(slug, {
        kind: "persona",
        id: persona.id,
        name: persona.name,
      }),
      keywords: [
        "persona",
        "geo",
        persona.role,
        persona.company,
        debouncedQuery,
      ],
    });
  }
  for (const site of data.sites) {
    hits.push({
      key: `site:${site.id}`,
      kind: "site",
      label: site.name,
      sublabel: site.publicOrigin.replace(URL_PROTOCOL_PATTERN, ""),
      icon: COMMAND_PALETTE_ENTITY_ICONS.site,
      path: commandPaletteEntityPath(slug, {
        kind: "site",
        id: site.id,
        name: site.name,
      }),
      keywords: ["site", site.publicOrigin, debouncedQuery],
    });
  }
  for (const chat of data.chats) {
    hits.push({
      key: `chat:${chat.id}`,
      kind: "chat",
      label: chat.title,
      icon: COMMAND_PALETTE_ENTITY_ICONS.chat,
      path: commandPaletteEntityPath(slug, {
        kind: "chat",
        id: chat.id,
        name: chat.title,
      }),
      keywords: ["chat", "conversation", debouncedQuery],
    });
  }
  return hits;
}

function groupEntityHits(
  entityHits: readonly EntityHit[]
): EntityHitsBySection {
  const groups: EntityHitsBySection = {
    prompts: [],
    competitors: [],
    personas: [],
    posts: [],
    chats: [],
    sites: [],
    brandVoices: [],
    references: [],
    integrations: [],
  };
  for (const hit of entityHits) {
    groups[ENTITY_SECTION_BY_KIND[hit.kind]].push(hit);
  }
  return groups;
}

/**
 * Debounced workspace search behind the palette list: GEO entities, posts,
 * chats, sites and brand data, grouped by section. Tracks one search event
 * per settled query.
 */
export function useCommandPaletteEntitySearch({
  open,
  enabled,
  organizationId,
  projectId,
  isProjectResolved,
  slug,
  query,
}: UseCommandPaletteEntitySearchParams): CommandPaletteEntitySearchResult {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const lastTrackedSearchRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const id = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, COMMAND_PALETTE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) {
      lastTrackedSearchRef.current = null;
    }
  }, [open]);

  const canSearch = open && enabled && organizationId.length > 0;
  const searchEnabled =
    canSearch && debouncedQuery.length >= COMMAND_PALETTE_SEARCH_MIN_LENGTH;

  const searchResults = useQuery({
    ...dashboardOrpc.search.global.queryOptions({
      input: {
        organizationId,
        projectId: projectId ?? undefined,
        query: debouncedQuery,
      },
    }),
    enabled: searchEnabled && isProjectResolved,
    staleTime: 15_000,
  });

  const isCurrentQuery =
    query.trim() === debouncedQuery &&
    debouncedQuery.length >= COMMAND_PALETTE_SEARCH_MIN_LENGTH;
  const entityHits = collectEntityHits(
    isCurrentQuery ? searchResults.data : undefined,
    slug,
    isProjectResolved,
    debouncedQuery,
    t,
    tCommon
  );
  const entityHitCount = entityHits.length;
  const hasSearchData = isCurrentQuery && searchResults.data !== undefined;

  useEffect(() => {
    if (
      !(searchEnabled && hasSearchData) ||
      lastTrackedSearchRef.current === debouncedQuery
    ) {
      return;
    }
    lastTrackedSearchRef.current = debouncedQuery;
    trackEvent(POSTHOG_EVENTS.COMMAND_PALETTE_SEARCH, {
      query_length: debouncedQuery.length,
      result_count: entityHitCount,
    });
  }, [debouncedQuery, entityHitCount, hasSearchData, searchEnabled]);

  return {
    entityHitsBySection: groupEntityHits(entityHits),
    isSearchError: searchEnabled && isCurrentQuery && searchResults.isError,
    retrySearch: () => {
      void searchResults.refetch();
    },
    isSearchPending:
      canSearch &&
      isCommandPaletteSearchPending(
        query,
        debouncedQuery,
        !isProjectResolved ||
          searchResults.isPending ||
          searchResults.isFetching
      ),
  };
}
