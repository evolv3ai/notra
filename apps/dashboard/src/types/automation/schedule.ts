import type {
  ScheduleCron,
  ScheduleFormValues,
} from "@notra/schemas/dashboard/automation/schedule-form";

import type { Trigger } from "@/types/triggers/triggers";

export type {
  ScheduleCron,
  ScheduleFormValues,
} from "@notra/schemas/dashboard/automation/schedule-form";

export interface ScheduleFormProps {
  organizationId: string;
  onSuccess?: (trigger: Trigger) => void;
  editTrigger?: Trigger;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presetId?: SchedulePresetId | null;
  /** Field values that win over the preset, e.g. from an agent suggestion. */
  presetValues?: Partial<ScheduleFormValues>;
  /** Lets a new automation switch to another trigger kind. */
  kindPicker?: React.ReactNode;
}

export interface ScheduleTriggerRowProps {
  schedule: ScheduleCron;
  onFrequencyChange: (next: ScheduleCron["frequency"]) => void;
  onDayOfWeekChange: (day: number) => void;
  onDayOfMonthChange: (day: number) => void;
  onIntervalDaysChange: (days: number | undefined) => void;
  onTimeChange: (hour: number, minute: number) => void;
}

export type SchedulePresetId =
  | "weekly-changelog"
  | "daily-twitter"
  | "monthly-blog"
  | "biweekly-linkedin";

export type SchedulePresetValues = Pick<
  ScheduleFormValues,
  "outputType" | "schedule" | "lookbackWindow"
>;

export interface SchedulePreset {
  id: SchedulePresetId;
  values: SchedulePresetValues;
}
