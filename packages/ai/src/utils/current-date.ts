const FALLBACK_TIMEZONE = "UTC";

export function formatCurrentDate(timezone?: string): {
  formatted: string;
  timezone: string;
} {
  const resolvedTimezone =
    timezone && isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE;
  const formatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: resolvedTimezone,
  });

  return { formatted, timezone: resolvedTimezone };
}

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
