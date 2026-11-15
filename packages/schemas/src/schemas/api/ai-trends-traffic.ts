import { z } from "zod";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Window the console asks the dashboard for. Daily rows cover `from` up to
 * the day before `toExclusive`; per-project rows split `baselineFrom` up to
 * `toExclusive` into weeks counted back from `recentFrom`, so `from` must not
 * be later than `baselineFrom`.
 */
export const aiTrendsTrafficRequestSchema = z.object({
  from: daySchema,
  baselineFrom: daySchema,
  recentFrom: daySchema,
  toExclusive: daySchema,
});

export const aiTrendsTrafficDailyRowSchema = z.object({
  day: daySchema,
  visitor_type: z.string(),
  source: z.string(),
  category: z.string(),
  visits: z.coerce.number(),
  markdown_visits: z.coerce.number(),
  projects: z.coerce.number(),
  median_visits: z.coerce.number(),
});

export const aiTrendsTrafficProjectRowSchema = z.object({
  project_id: z.string(),
  visitor_type: z.string(),
  source: z.string(),
  /** 0 for the week from `recentFrom`, 1 and up for the baseline weeks before it. */
  weeks_ago: z.coerce.number().int().nonnegative(),
  visits: z.coerce.number(),
});

export const aiTrendsTrafficResponseSchema = z.object({
  configured: z.boolean(),
  daily: z.array(aiTrendsTrafficDailyRowSchema),
  projects: z.array(aiTrendsTrafficProjectRowSchema),
});
