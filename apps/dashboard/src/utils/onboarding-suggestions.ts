import { CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS } from "@notra/ai/constants/schedule-interval";
import { onboardingSuggestionPresetSchema } from "@notra/ai/schemas/onboarding-agent";
import { toUtcDateString } from "@notra/ai/utils/schedule-interval";
import {
  MAX_SCHEDULE_INSTRUCTIONS_LENGTH,
  MAX_SCHEDULE_NAME_LENGTH,
} from "@notra/schemas/dashboard/integrations";

import { DEFAULT_SCHEDULE } from "@/constants/schedule";
import type { EventTriggerPreset } from "@/types/automation/automations";
import type { ScheduleFormValues } from "@/types/automation/schedule";
import type { OnboardingSuggestionDraft } from "@/types/components/onboarding-suggestions";

function presetOf(suggestion: OnboardingSuggestionDraft) {
  const raw =
    suggestion.data && typeof suggestion.data === "object"
      ? (suggestion.data as Record<string, unknown>).preset
      : undefined;
  const parsed = onboardingSuggestionPresetSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Editor values for a schedule suggestion; older suggestions only carry text. */
export function scheduleValuesFromSuggestion(
  suggestion: OnboardingSuggestionDraft
): Partial<ScheduleFormValues> {
  const preset = presetOf(suggestion);
  const instructions = (preset?.instructions ?? suggestion.description ?? "")
    .trim()
    .slice(0, MAX_SCHEDULE_INSTRUCTIONS_LENGTH);
  const values: Partial<ScheduleFormValues> = {
    name: suggestion.title.trim().slice(0, MAX_SCHEDULE_NAME_LENGTH),
    instructions,
  };
  if (!preset) {
    return values;
  }
  values.outputType = preset.outputType;
  if (preset.frequency) {
    values.schedule = {
      frequency: preset.frequency,
      hour: preset.hour ?? DEFAULT_SCHEDULE.hour,
      minute: 0,
      ...(preset.frequency === "weekly"
        ? { dayOfWeek: preset.dayOfWeek ?? 1 }
        : {}),
      ...(preset.frequency === "monthly"
        ? { dayOfMonth: preset.dayOfMonth ?? 1 }
        : {}),
      ...(preset.frequency === "custom"
        ? {
            intervalDays:
              preset.intervalDays ?? CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS,
            anchorDate: toUtcDateString(new Date()),
          }
        : {}),
    };
  }
  return values;
}

export function eventPresetFromSuggestion(
  suggestion: OnboardingSuggestionDraft
): EventTriggerPreset | null {
  const preset = presetOf(suggestion);
  return preset
    ? {
        eventType: preset.eventType ?? "release",
        outputType: preset.outputType,
      }
    : null;
}
