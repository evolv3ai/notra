import type { DateTimeFormatOptions } from "use-intl";

import type {
  ScheduleDialogMode,
  ScheduleDialogModeConfig,
  SchedulePollTier,
} from "@/types/content/schedule";

export const CONTENT_CALENDAR_WEEK_STARTS_ON = 1;

export const CONTENT_CALENDAR_MONTH_CELL_LIMIT = 3;

export const CONTENT_CALENDAR_DEFAULT_HOUR = 9;

export const CONTENT_CALENDAR_MAX_PROJECTED_RUNS = 62;

export const CONTENT_CALENDAR_PREFETCH_STALE_MS = 30_000;

export const CONTENT_CALENDAR_DATE_PARAM = "date";

export const CONTENT_CALENDAR_TOOLTIP_DELAY_MS = 300;

export const CONTENT_CALENDAR_POLL_MS = {
  active: 15_000,
  idle: 60_000,
} as const satisfies Record<SchedulePollTier, number>;

export const POST_SCHEDULE_POLL_MS = {
  active: 5000,
  idle: 60_000,
} as const satisfies Record<SchedulePollTier, number>;

export const POST_SCHEDULE_IMMINENT_WINDOW_MS = 2 * 60 * 1000;

export const CONTENT_CALENDAR_DRAG_MIME = "application/x-notra-calendar-post";

export const SCHEDULE_SLOT_DATE_FORMAT = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
} as const satisfies DateTimeFormatOptions;

export const SCHEDULED_PUBLICATION_STATUS_DOTS = {
  scheduled: "bg-info",
  publishing: "bg-warning",
  published: "bg-success",
  failed: "bg-destructive",
  canceled: "bg-muted-foreground",
} as const;

export const SCHEDULE_DIALOG_MODES = {
  create: {
    titleKey: "title",
    secondaryAction: null,
    canPublishNow: false,
    editable: true,
  },
  edit: {
    titleKey: "editTitle",
    secondaryAction: "unschedule",
    canPublishNow: true,
    editable: true,
  },
  locked: {
    titleKey: "statusTitle",
    secondaryAction: "unschedule",
    canPublishNow: false,
    editable: false,
  },
  failed: {
    titleKey: "statusTitle",
    secondaryAction: "dismiss",
    canPublishNow: false,
    editable: false,
  },
} as const satisfies Record<ScheduleDialogMode, ScheduleDialogModeConfig>;

export const SCHEDULED_PUBLICATION_WAKE_EARLY_TOLERANCE_MS = 5 * 1000;

export const SCHEDULED_PUBLICATION_ATTEMPT_ROUTE_PATH =
  "/api/internal/content/scheduled-publication-attempt";
