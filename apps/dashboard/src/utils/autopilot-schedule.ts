import type { AutopilotSchedule } from "@/types/autopilot-runtime";

function localParts(date: Date, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

function localFormatter(timezone: string) {
  const options = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  } as const;
  try {
    return new Intl.DateTimeFormat("en-CA", options);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
  }
}

/** Earlier manual or onboarding runs don't replace today's scheduled brief. */
export function isAutopilotDue(settings: AutopilotSchedule, now: Date) {
  const formatter = localFormatter(settings.timezone);
  const current = localParts(now, formatter);
  if (current.hour < settings.briefHour) {
    return false;
  }
  if (!settings.lastRunAt) {
    return true;
  }
  const last = localParts(settings.lastRunAt, formatter);
  return last.day !== current.day || last.hour < settings.briefHour;
}
