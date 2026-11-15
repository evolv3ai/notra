import {
  CheckmarkCircle02Icon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons";
import type { SiteInputField } from "@notra/sites-server/types/sites";
import { TRANSITION } from "@notra/ui/lib/motion";
import type { Variants } from "motion/react";

import type {
  SiteCreateDeployHeadingProps,
  SiteCreateDeployPhase,
} from "@/types/components/sites";
import type { SiteCreateFormValues } from "@/types/sites";

export const SITE_CREATE_FORM_DEFAULTS: SiteCreateFormValues = {
  repositoryId: null,
  name: "",
  slug: "",
  branch: "",
  rootDirectory: "",
  blogPath: null,
  changelogPath: null,
  previewVisibility: "protected",
};

export const SITE_CREATE_INPUT_FIELDS: readonly SiteInputField[] = [
  "repository",
  "name",
  "slug",
  "rootDirectory",
  "sections",
];

export const SITE_CREATE_FIELD_INPUT_SUFFIXES: Partial<
  Record<SiteInputField, string>
> = {
  name: "name",
  slug: "slug",
  rootDirectory: "root",
};

export const SITE_CREATE_VALUE_FIELDS: Partial<
  Record<keyof SiteCreateFormValues, SiteInputField>
> = {
  repositoryId: "repository",
  name: "name",
  slug: "slug",
  rootDirectory: "rootDirectory",
  blogPath: "sections",
  changelogPath: "sections",
};

export const SITE_CREATE_STEP_IDS = [
  "repository",
  "configure",
  "deploy",
] as const;

export const SITE_CREATE_DEPLOY_POLL_MS = 1500;

const SITE_IMPORT_SKELETON_ROWS = 5;
export const SITE_IMPORT_SKELETON_KEYS = Array.from(
  { length: SITE_IMPORT_SKELETON_ROWS },
  (_, index) => `skeleton-${index}`
);

export const SITE_CREATE_FOCUS_DELAY_MS = 600;

export const SITE_CREATE_CONFIG_VARIANTS: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } },
};

export const SITE_CREATE_ROW_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  shown: { opacity: 1, y: 0, transition: TRANSITION.enter },
};

export const SITE_CREATE_STAGE_FIRST_OFFSET_PX = 8;
export const SITE_CREATE_STAGE_EDGE_PX = 24;
export const SITE_CREATE_SCROLL_FADE_REM = 1.5;

export const SITE_CREATE_STARTER_DEBOUNCE_MS = 400;
export const SITE_CREATE_DEPLOY_PHASE_TONES: Record<
  SiteCreateDeployPhase,
  SiteCreateDeployHeadingProps["tone"]
> = {
  pending: "pending",
  ready: "success",
  failed: "error",
  lookupFailed: "error",
};

export const SITE_CREATE_DEPLOY_TONE_ICONS = {
  pending: Loading03Icon,
  success: CheckmarkCircle02Icon,
  error: MultiplicationSignCircleIcon,
} as const;

export const SITE_BULK_IMPORT_MIN_DIRECTORIES = 2;
export const SITE_BULK_ROW_HEIGHT = 84;

export const SITE_BULK_FOLDER_WORD_SEPARATOR = /[-_.\s]+/;
export const SITE_IMPORT_SCROLL_END_TOLERANCE_PX = 4;
