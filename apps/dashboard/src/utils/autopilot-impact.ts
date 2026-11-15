import type { AutopilotImpact } from "@/types/autopilot-runtime";

function formatValue(metric: AutopilotImpact["metric"], value: number) {
  if (metric === "mentions") {
    return `${Math.round(value * 100)}%`;
  }
  if (metric === "position") {
    return `#${Math.round(value * 10) / 10}`;
  }
  return String(Math.round(value));
}

/** "11% → 40%", "#14 → #6" or "61 → 78"; after the merge only once data exists. */
export function describeImpact(impact: AutopilotImpact, merged: boolean) {
  const before =
    impact.before === null ? "–" : formatValue(impact.metric, impact.before);
  if (!merged) {
    return { text: `${before} now`, improved: false };
  }
  if (impact.after === null) {
    return { text: `${before} → measuring`, improved: false };
  }
  const after = formatValue(impact.metric, impact.after);
  let improved = false;
  if (impact.before !== null) {
    // Position counts down: #6 beats #14.
    improved =
      impact.metric === "position"
        ? impact.after < impact.before
        : impact.after > impact.before;
  }
  return { text: `${before} → ${after}`, improved };
}
