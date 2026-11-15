/** search_console comes from GSC queries; autopilot from Autopilot's prompt review. */
export const GEO_PROMPT_SUGGESTION_SOURCES = [
  "search_console",
  "autopilot",
] as const;

export const GEO_PROMPT_SUGGESTION_ACTIONS = ["track", "pause"] as const;
