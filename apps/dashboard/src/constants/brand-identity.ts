import { SUPPORTED_LANGUAGES } from "@notra/ai/constants/languages";
import type { ToneProfile } from "@notra/ai/schemas/tone";

import type { BrandTab } from "@/types/brand-identity";

export const AUTO_SAVE_DELAY = 2500;

export const ANALYSIS_STEPS = [
  { value: "scraping" },
  { value: "extracting" },
  { value: "saving" },
] as const;

export const TONE_OPTIONS: { value: ToneProfile }[] = [
  { value: "Conversational" },
  { value: "Professional" },
  { value: "Casual" },
  { value: "Formal" },
];

export const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES;

export { LANGUAGE_FLAGS } from "@/constants/language-flags";

export const FULL_URL_REGEX = /^https?:\/\//i;

export const IDENTITY_NAME_MAX_LENGTH = 13;

export const BRAND_IDENTITY_TAB_VALUES = [
  "identity",
  "references",
  "sitemap",
  "guidelines",
] as const satisfies readonly BrandTab[];

export const BRAND_IDENTITY_HEADER_LAYOUTS = [
  "toolbar",
  "summary",
  "cards",
] as const;
