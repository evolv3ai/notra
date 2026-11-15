import type { SchedulePreset } from "@/types/automation/schedule";

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "weekly-changelog",
    values: {
      outputType: "changelog",
      schedule: { frequency: "weekly", dayOfWeek: 1, hour: 9, minute: 0 },
      lookbackWindow: "last_7_days",
    },
  },
  {
    id: "daily-twitter",
    values: {
      outputType: "twitter_post",
      schedule: { frequency: "daily", hour: 9, minute: 0 },
      lookbackWindow: "yesterday",
    },
  },
  {
    id: "monthly-blog",
    values: {
      outputType: "blog_post",
      schedule: { frequency: "monthly", dayOfMonth: 1, hour: 9, minute: 0 },
      lookbackWindow: "last_30_days",
    },
  },
  {
    id: "biweekly-linkedin",
    values: {
      outputType: "linkedin_post",
      schedule: { frequency: "custom", intervalDays: 14, hour: 9, minute: 0 },
      lookbackWindow: "last_14_days",
    },
  },
];
