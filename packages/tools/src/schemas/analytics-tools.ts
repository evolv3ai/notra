import { z } from "zod";

export const getSocialAnalyticsOverviewInputSchema = z.object({});

export const getTopPostsInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10)
    .describe("Maximum number of posts to return, ranked by engagement."),
});

export const getEngagementTimeseriesInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Number of trailing days to include."),
});

export const getPostingPerformanceInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(90)
    .describe("Number of trailing days to include."),
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const analyticsRangeFields = {
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe(
      "Number of days to include, counting today (UTC). 7 means today and the 6 days before it. Ignored when from is set."
    ),
  from: isoDateSchema
    .optional()
    .describe("Inclusive first day (YYYY-MM-DD, UTC). Overrides days."),
  to: isoDateSchema
    .optional()
    .describe(
      "Inclusive last day (YYYY-MM-DD, UTC). Only used with from; defaults to today."
    ),
};

const projectIdField = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Project ID from list_geo_projects. Defaults to the organization's oldest project."
  );

export const listGeoProjectsInputSchema = z.object({});

export const getGeoOverviewInputSchema = z.object({
  projectId: projectIdField,
  ...analyticsRangeFields,
});

export const webAnalyticsDimensions = [
  "country",
  "device",
  "browser",
  "os",
] as const;

export const getWebAnalyticsInputSchema = z.object({
  projectId: projectIdField,
  siteId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Notra hosted site ID from get_sites. Scopes the result to that site instead of a project."
    ),
  host: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Only count this domain, such as www.example.com. Subdomains match."
    ),
  path: z
    .string()
    .startsWith("/")
    .optional()
    .describe("Only count this exact page path, such as /pricing."),
  dimension: z
    .enum(webAnalyticsDimensions)
    .default("country")
    .describe("Audience breakdown to return: country, device, browser or os."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum rows per breakdown, top pages and top sources."),
  ...analyticsRangeFields,
});

export const getAbTestsInputSchema = z.object({});

export const createAbTestInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .describe("Short descriptive name for the experiment."),
  hypothesis: z
    .string()
    .max(500)
    .optional()
    .describe("What you expect to learn and why."),
  variantAPostId: z
    .string()
    .min(1)
    .describe("Platform post id of variant A (from get_top_posts)."),
  variantBPostId: z
    .string()
    .min(1)
    .describe("Platform post id of variant B (from get_top_posts)."),
  metric: z
    .enum(["engagement", "impressions", "likes"])
    .default("engagement")
    .describe("Metric the variants compete on."),
  provider: z
    .enum(["twitter", "linkedin"])
    .default("twitter")
    .describe("Platform both posts belong to."),
});
