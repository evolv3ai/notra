import {
  CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS,
  CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS,
} from "@notra/ai/constants/schedule-interval";
import {
  SCHEDULE_FREQUENCIES,
  SCHEDULE_OUTPUT_TYPES,
} from "@notra/ai/schemas/schedules";
import { z } from "zod";

/**
 * Automation settings the onboarding agent proposes with a suggestion, so
 * opening it fills the editor instead of starting from an empty form.
 */
export const onboardingSuggestionPresetSchema = z.object({
  outputType: z
    .enum(SCHEDULE_OUTPUT_TYPES)
    .describe(
      "Content drafted each run: changelog, blog_post, linkedin_post, twitter_post, or image."
    ),
  eventType: z
    .enum(["release", "push"])
    .optional()
    .describe("event_automation only: the GitHub event that triggers a draft."),
  frequency: z
    .enum(SCHEDULE_FREQUENCIES)
    .optional()
    .describe(
      "schedule_automation only: daily, weekly, monthly, or custom (every intervalDays days)."
    ),
  dayOfWeek: z
    .number()
    .int()
    .min(0)
    .max(6)
    .optional()
    .describe("Weekly schedules: 0 = Sunday … 6 = Saturday."),
  dayOfMonth: z
    .number()
    .int()
    .min(1)
    .max(28)
    .optional()
    .describe("Monthly schedules: day of the month."),
  intervalDays: z
    .number()
    .int()
    .min(CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS)
    .max(CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS)
    .optional()
    .describe("Custom schedules: days between runs, e.g. 14 for biweekly."),
  hour: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("Hour of day in UTC."),
  instructions: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .optional()
    .describe(
      "schedule_automation only: guidance for the writer on every run, what to cover and how, grounded in the research. Event automations have no instructions."
    ),
});

export type OnboardingSuggestionPreset = z.infer<
  typeof onboardingSuggestionPresetSchema
>;

export const onboardingProfileSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().nullable(),
  socialHandles: z.object({
    twitter: z.string().nullable(),
    linkedin: z.string().nullable(),
  }),
  productSummary: z.string().min(1),
  audience: z.string().min(1),
  tone: z.string().min(1),
  contentPillars: z.array(z.string()).min(1),
  competitors: z.array(z.string()),
  memoriesSaved: z.array(z.string()),
  skillEditsApplied: z.array(z.string()),
  brandUpdatesApplied: z.array(z.string()),
  referencesAdded: z.array(z.string()),
  suggestionsCreated: z.array(z.string()),
  sources: z.array(z.string()),
});
