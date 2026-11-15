import "zod/compile";
import {
  AUTOPILOT_AUTOMATION_KINDS,
  AUTOPILOT_JOB_KINDS,
} from "@notra/db/constants/autopilot";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const GITHUB_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
/** A GitHub user or app login; app logins end in [bot]. */
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/;
const GITHUB_FULL_NAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** Repository-relative: no leading slash, no "..", no backslashes. */
const REPOSITORY_PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\\0]+$/;
const AUTOPILOT_MAX_EXCLUDED_AUTHORS = 50;
const AUTOPILOT_MAX_PATH_FILTER_REPOSITORIES = 50;
const AUTOPILOT_MAX_PATHS_PER_REPOSITORY = 20;

function uniqueLowercase(values: string[]) {
  return [...new Set(values.map((value) => value.toLowerCase()))];
}

export const autopilotOrganizationInputSchema = z.object({
  organizationId: organizationIdSchema,
});

export const autopilotMetricsDaysSchema = z.union([
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);
export const autopilotMetricsInputSchema =
  autopilotOrganizationInputSchema.extend({
    days: autopilotMetricsDaysSchema.default(30),
  });

export const autopilotFindingInputSchema =
  autopilotOrganizationInputSchema.extend({
    findingId: z.string().trim().min(1).max(64),
  });

export const autopilotRunInputSchema = autopilotOrganizationInputSchema.extend({
  runId: z.string().trim().min(1).max(64),
});

/** GitHub's three ways to merge a pull request. */
export const autopilotMergeMethodSchema = z.enum(["squash", "merge", "rebase"]);

export const autopilotMergeInputSchema = autopilotFindingInputSchema.extend({
  /** Omitted: the first method the repository allows, squash first. */
  method: autopilotMergeMethodSchema.optional(),
});

export const autopilotDismissInputSchema = autopilotFindingInputSchema.extend({
  /** Optional "why"; when it states a preference it becomes an Autopilot rule. */
  reason: z.string().trim().max(300).optional(),
});

export const autopilotRuleInputSchema = autopilotOrganizationInputSchema.extend(
  { text: z.string().trim().min(3).max(300) }
);

export const autopilotRuleIdInputSchema =
  autopilotOrganizationInputSchema.extend({
    ruleId: z.string().trim().min(1).max(64),
  });

export const autopilotJobsSchema = z.object({
  readiness: z.boolean(),
  keywords: z.boolean(),
  commits: z.boolean(),
  prompts: z.boolean().default(true),
  competitors: z.boolean(),
});

export const autopilotSaveInputSchema = autopilotOrganizationInputSchema.extend(
  {
    enabled: z.boolean(),
    /** GEO project Autopilot works for. Omit to keep the saved project. */
    projectId: z.string().trim().min(1).max(64).optional(),
    repository: z
      .object({
        owner: z.string().trim().min(1).max(100).regex(GITHUB_NAME_PATTERN),
        name: z.string().trim().min(1).max(100).regex(GITHUB_NAME_PATTERN),
        branch: z.string().trim().min(1).max(255),
      })
      .nullable(),
    contentPath: z.string().trim().max(200).nullable(),
    slack: z
      .object({
        integrationId: z.string().trim().min(1),
        channelId: z.string().trim().min(1).max(64),
        channelName: z.string().trim().max(200).nullable(),
      })
      .nullable(),
    briefHour: z.number().int().min(0).max(23),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine(isValidTimezone, "Unknown timezone"),
    /** Omit to keep the saved jobs; the settings page turns them on and off one at a time. */
    jobs: autopilotJobsSchema.optional(),
    maxOpenPullRequests: z.number().int().min(1).max(10),
    /** Days before an untouched draft is closed; null never closes. Omit to keep. */
    stalePullRequestDays: z
      .union([z.literal(7), z.literal(14), z.literal(30)])
      .nullable()
      .optional(),
  }
);

export const autopilotGitHubLoginSchema = z
  .string()
  .trim()
  .regex(GITHUB_LOGIN_PATTERN, "Use a GitHub login");

/** A path prefix or glob inside a repository, like apps/web or docs/**. */
export const autopilotRepositoryPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(REPOSITORY_PATH_PATTERN, "Use a path inside the repository");

/** Author and path filters for the pull requests "Write about releases" reads. */
export const autopilotCommitFiltersSchema = z.object({
  excludedAuthors: z
    .array(autopilotGitHubLoginSchema)
    .max(AUTOPILOT_MAX_EXCLUDED_AUTHORS)
    .transform(uniqueLowercase),
  paths: z
    .record(
      z.string().max(201).regex(GITHUB_FULL_NAME_PATTERN, "Use owner/name"),
      z
        .array(autopilotRepositoryPathSchema)
        .max(AUTOPILOT_MAX_PATHS_PER_REPOSITORY)
        .transform((values) => [...new Set(values)])
    )
    .refine(
      (paths) =>
        Object.keys(paths).length <= AUTOPILOT_MAX_PATH_FILTER_REPOSITORIES,
      "Too many repositories"
    )
    // Keys are matched lowercase; a repository without paths has no filter.
    .transform((paths) => {
      const merged: Record<string, string[]> = {};
      for (const [repository, values] of Object.entries(paths)) {
        const key = repository.toLowerCase();
        merged[key] = [...new Set([...(merged[key] ?? []), ...values])];
      }
      return Object.fromEntries(
        Object.entries(merged).filter(([, values]) => values.length > 0)
      );
    }),
});

/** Replaces the commit filters as a whole, like a job toggle. */
export const autopilotSetCommitFiltersInputSchema =
  autopilotOrganizationInputSchema.extend({
    filters: autopilotCommitFiltersSchema,
  });

/** Turns one job on or off without resending the whole settings form. */
export const autopilotSetJobInputSchema =
  autopilotOrganizationInputSchema.extend({
    kind: z.enum(AUTOPILOT_JOB_KINDS),
    enabled: z.boolean(),
  });

/** One job's recent outcomes, for its automation page. */
export const autopilotJobDecisionsInputSchema =
  autopilotOrganizationInputSchema.extend({
    kind: z.enum(AUTOPILOT_JOB_KINDS),
  });

export const autopilotRunNowInputSchema =
  autopilotOrganizationInputSchema.extend({
    trigger: z.enum(["manual", "onboarding"]).default("manual"),
    /** Runs only this automation instead of the whole daily run. */
    kind: z.enum(AUTOPILOT_AUTOMATION_KINDS).optional(),
  });
