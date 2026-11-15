import {
  ChartHistogramIcon,
  CloudServerIcon,
  Database02Icon,
  Mail01Icon,
  Megaphone01Icon,
  ShieldKeyIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { STATE_OF_AI_SEARCH_TITLE } from "@/constants/state-of-ai-search";
import { listLatestSummaries } from "@/lib/state-of-ai-search/reports";
import type { StateOfAiSearchRankingRow } from "@/types/state-of-ai-search";
import type { MarketingNavGroup } from "@/utils/navigation";
import { reportCategoryPath } from "@/utils/state-of-ai-search";

const REPORT_CATEGORY_ICONS: Record<string, IconSvgElement> = {
  "ai-visibility": ViewIcon,
  "app-hosting": CloudServerIcon,
  auth: ShieldKeyIcon,
  changelog: Megaphone01Icon,
  "email-api": Mail01Icon,
  postgres: Database02Icon,
};

const REPORT_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "ai-visibility": "See which GEO tools AI recommends",
  "app-hosting": "How hosting platforms rank in AI search",
  auth: "Auth providers recommended by AI",
  changelog: "Release note tools recommended by AI",
  "email-api": "Email providers ranked in AI search",
  postgres: "The Postgres providers AI recommends",
};

const LATEST_REPORTS = listLatestSummaries();

const REPORTS_NAV_LEADER_COUNT = 3;

export const REPORTS_NAV_LEADERS: Record<string, StateOfAiSearchRankingRow[]> =
  Object.fromEntries(
    LATEST_REPORTS.map((report) => [
      reportCategoryPath(report.slug),
      report.leaders.slice(0, REPORTS_NAV_LEADER_COUNT),
    ])
  );

export const REPORTS_NAV_EDITION = LATEST_REPORTS[0]?.editionLabel;

export const REPORTS_NAV: MarketingNavGroup = {
  type: "group",
  layout: "compact",
  panel: "reports",
  label: "Reports",
  cardsHeading: STATE_OF_AI_SEARCH_TITLE,
  cards: [],
  railHeading: "Categories",
  rail: LATEST_REPORTS.map((report) => ({
    href: reportCategoryPath(report.slug),
    label: report.subject,
    description:
      REPORT_CATEGORY_DESCRIPTIONS[report.slug] ?? "Monthly AI search rankings",
    icon: REPORT_CATEGORY_ICONS[report.slug] ?? ChartHistogramIcon,
  })),
};
