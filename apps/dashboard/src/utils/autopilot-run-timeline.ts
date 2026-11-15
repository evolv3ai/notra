import type { AutopilotJobKind } from "@notra/db/types/autopilot";

import { AUTOPILOT_RUN_SECTIONS } from "@/constants/autopilot";

type PhaseState = "complete" | "active" | "failed";

export interface AutopilotRunPhase {
  id: string;
  label: string;
  state: PhaseState;
  startedAt: number;
  durationMs: number;
}

/**
 * One phase per job that logged anything, in run order. A phase lasts until
 * the next one starts (or the run ends), so the bars add up to the run. Jobs
 * can run side by side, so the active one is the one that logged last.
 */
export function runTimelinePhases(
  events: {
    job: AutopilotJobKind | null;
    level: string;
    createdAt: Date | string;
  }[],
  run: { status: string; finishedAt: Date | string | null },
  now: number
): AutopilotRunPhase[] {
  const sections = AUTOPILOT_RUN_SECTIONS.flatMap((section) => {
    const own = events.filter((event) => event.job === section.job);
    const first = own[0];
    if (!first) {
      return [];
    }
    return [
      {
        id: section.job ?? "run",
        label: section.label,
        failed: own.some((event) => event.level === "error"),
        startedAt: new Date(first.createdAt).getTime(),
        lastAt: new Date(own.at(-1)?.createdAt ?? first.createdAt).getTime(),
      },
    ];
  }).sort((a, b) => a.startedAt - b.startedAt);
  const runEnd = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  const latest = Math.max(...sections.map((section) => section.lastAt));
  return sections.map((section, index) => {
    const next = sections[index + 1];
    const end = next ? next.startedAt : Math.max(runEnd, section.lastAt);
    let state: PhaseState = "complete";
    if (section.failed) {
      state = "failed";
    } else if (run.status === "running" && section.lastAt === latest) {
      state = "active";
    }
    return {
      id: section.id,
      label: section.label,
      state,
      startedAt: section.startedAt,
      durationMs: Math.max(0, end - section.startedAt),
    };
  });
}
