import {
  AiBrain01Icon,
  SearchIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import type { GeoPresenceStatus } from "@notra/geo-core/types/geo";
import { GEO_PROMPT_FILTER_ALL } from "@notra/schemas/constants/dashboard/geo-prompts";

import type { GeoPromptTableFilters } from "@/types/geo";

export const GEO_PROMPT_DEFAULT_FILTERS: GeoPromptTableFilters = {
  q: "",
  intent: GEO_PROMPT_FILTER_ALL,
  tag: GEO_PROMPT_FILTER_ALL,
  source: GEO_PROMPT_FILTER_ALL,
};
export const GEO_PROMPT_FILTER_SELECT_CLASS = "w-36";

export const GEO_PROMPT_LABEL_PILL_CLASS =
  "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap";

export const GEO_PROMPT_PRESENCE_ICONS: Record<
  GeoPresenceStatus,
  typeof AiBrain01Icon
> = {
  "training-data": AiBrain01Icon,
  "retrieval-only": SearchIcon,
  invisible: ViewOffSlashIcon,
};

export const GEO_PROMPT_PRESENCE_PILL_CLASS: Record<GeoPresenceStatus, string> =
  {
    "training-data": "border-success/25 bg-success/10 text-success",
    "retrieval-only": "border-warning/25 bg-warning/10 text-warning",
    invisible:
      "border-border bg-muted/50 text-muted-foreground dark:bg-muted/30",
  };
export const GEO_PROMPT_OUTCOME_LABEL_KEYS = {
  mentionedAndCited: "mentionedAndCited",
  mentioned: "mentioned",
  cited: "ownedSourceCited",
  notMentioned: "notMentioned",
} as const;

export const GSC_SETUP_EXAMPLES = [
  { key: "projectManagement", impressions: 1240 },
  { key: "startupCrm", impressions: 860 },
  { key: "invoicing", impressions: 430 },
] as const;

export const GEO_PROMPT_DETAIL_QUERY_KEY = "prompt";

export const GEO_PROMPTS_PAGE_TABS = [
  "prompts",
  "conversations",
  "suggestions",
  "answers",
] as const;
