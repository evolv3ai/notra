import { GEO_PROMPTS_NAV_LINK } from "@notra/geo-core/constants/geo";
import { ONBOARDING_HEARD_ABOUT_NOTRA_SOURCES } from "@notra/schemas/constants/dashboard/onboarding";

import {
  DEFAULT_NAV_VISIBILITY,
  GEO_COMPETITORS_NAV_LINK,
  GEO_OVERVIEW_NAV_LINK,
  NAV_GROUPS,
} from "@/constants/nav";
import type {
  OnboardingPreviewFocus,
  OnboardingPreviewPage,
  OnboardingPreviewZoom,
} from "@/types/onboarding";

export const ONBOARDING_STEP_COUNT = 3;
export const ONBOARDING_STEP_WORKSPACE = 1;
export const ONBOARDING_STEP_VISIBILITY = 2;
export const ONBOARDING_STEP_COMPETITORS = 3;
export const ONBOARDING_VISIBILITY_MAX_PROMPTS = 20;
export const ONBOARDING_VISIBLE_SUGGESTIONS = 3;
export const ONBOARDING_SUGGESTION_SKELETON_ROWS = [0, 1, 2, 3] as const;
export const ONBOARDING_PREVIEW_SKELETON_TABS = [
  "w-16",
  "w-24",
  "w-20",
] as const;
export const ONBOARDING_PREVIEW_SKELETON_CARDS = [
  { span: "col-span-5" },
  { span: "col-span-7" },
] as const;
export const ONBOARDING_PREVIEW_SKELETON_ROW_WIDTHS = [
  "w-32",
  "w-24",
  "w-36",
  "w-20",
  "w-28",
] as const;
export const ONBOARDING_FIELD_CLASS = "h-11 rounded-xl px-3.5";

export const ONBOARDING_HEARD_ABOUT_NOTRA_OPTIONS =
  ONBOARDING_HEARD_ABOUT_NOTRA_SOURCES.map((value) => ({
    value,
  }));

export const ONBOARDING_EMAIL_PREFS = [
  { key: "marketingEmails" },
  { key: "dailySummary" },
] as const;

export const ONBOARDING_PREVIEW_ZOOM: Record<
  OnboardingPreviewFocus,
  OnboardingPreviewZoom
> = {
  name: { scale: 1.6 },
  website: { scale: 1.6 },
  brand: { scale: 1.35, page: "overview" },
  prompts: { page: "prompts" },
  competitors: { page: "competitors" },
};

export const ONBOARDING_PREVIEW_NAV_GROUPS = NAV_GROUPS.filter(
  (group) => group.id !== "sites" || DEFAULT_NAV_VISIBILITY.sites
);

export const ONBOARDING_PREVIEW_LENS_MARGIN_PX = 24;
export const ONBOARDING_PREVIEW_LENS_PADDING_PX = 8;

export const ONBOARDING_PREVIEW_EMPTY_TABLE_ROWS = 3;

export const ONBOARDING_PREVIEW_PAGE_PATHS: Record<
  OnboardingPreviewPage,
  string
> = {
  overview: GEO_OVERVIEW_NAV_LINK,
  prompts: GEO_PROMPTS_NAV_LINK,
  competitors: GEO_COMPETITORS_NAV_LINK,
};

export const WORKSPACE_FIELD_INPUT_IDS = [
  ["name", "name"],
  ["slug", "slug"],
  ["websiteUrl", "website"],
  ["heardAboutNotraSource", "heard-about-notra"],
  ["heardAboutNotraOther", "heard-about-notra-other"],
] as const;

export const NOTRA_MCP_DOCS_URL = "https://www.usenotra.com/docs/devtools/mcp";
export const NOTRA_CHATGPT_APP_URL =
  "https://chatgpt.com/plugins/plugin_asdk_app_6ad054bf08248191a320ed1334e3ffde";
export const NOTRA_CLAUDE_DIRECTORY_URL = "https://claude.ai/directory/notra";
