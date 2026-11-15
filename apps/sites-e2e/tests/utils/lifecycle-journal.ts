import { writeFile } from "node:fs/promises";

import type { SandboxBuildResult } from "../../../../packages/sites-server/src/types/build";
import type { EmulatorSummary } from "../../emulators/core/types";
import type {
  LifecycleBuild,
  LifecycleJournalReport,
  LifecyclePhase,
} from "../types/lifecycle-journal";

// Records which step of the lifecycle ran, how long it took and every build
// it started, so a failed release names the step that broke instead of only
// the test file. Written to SITES_E2E_LIFECYCLE_REPORT when the runner sets it.
export function lifecycleJournal(builder: LifecycleJournalReport["builder"]) {
  const phases: LifecyclePhase[] = [];
  const builds: LifecycleBuild[] = [];
  let current: { name: string; started: number } | undefined;
  const path = process.env.SITES_E2E_LIFECYCLE_REPORT;
  const write = async (report: LifecycleJournalReport) => {
    if (path) {
      await writeFile(path, JSON.stringify(report, null, 2));
    }
  };
  const close = (status: LifecyclePhase["status"]) => {
    if (!current) {
      return;
    }
    const { name, started } = current;
    phases.push({
      name,
      status,
      durationMs: Math.round(performance.now() - started),
      builds: builds.filter((build) => build.phase === name).length,
    });
    current = undefined;
  };
  return {
    // Saved on every step so a run killed by its timeout still names the
    // step it was stuck in.
    async phase(name: string) {
      close("passed");
      current = { name, started: performance.now() };
      await write({
        builder,
        passed: false,
        failedPhase: null,
        runningPhase: name,
        error: null,
        phases,
        builds,
        webhookDeliveries: 0,
        emulators: [],
      });
    },
    build(build: SandboxBuildResult) {
      const diagnostic = build.result?.diagnostics.find(
        (entry) => entry.severity === "error"
      );
      builds.push({
        phase: current?.name ?? "setup",
        ok: build.result?.ok ?? false,
        durationMs: Math.round(build.durationMs),
        sandboxId: build.metrics?.sandboxId ?? null,
        phases: Object.fromEntries(
          Object.entries(build.metrics?.phases ?? {}).map(([name, ms]) => [
            name,
            Math.round(ms ?? 0),
          ])
        ),
        error: build.result?.ok
          ? null
          : (build.crash ??
            (diagnostic
              ? `${diagnostic.code}: ${diagnostic.message}`
              : "build failed without a diagnostic")),
      });
    },
    attemptFailed(error: string, durationMs = 0) {
      builds.push({
        phase: current?.name ?? "setup",
        ok: false,
        durationMs: Math.round(durationMs),
        sandboxId: null,
        error,
      });
    },
    async finish(
      error: unknown,
      webhookDeliveries: number,
      emulators: EmulatorSummary[]
    ) {
      const failedPhase = error ? (current?.name ?? "setup") : null;
      close(error ? "failed" : "passed");
      const report: LifecycleJournalReport = {
        builder,
        passed: !error,
        failedPhase,
        runningPhase: null,
        error: error
          ? (error instanceof Error ? error.message : String(error)).slice(
              0,
              2000
            )
          : null,
        phases,
        builds,
        webhookDeliveries,
        emulators,
      };
      await write(report);
      return report;
    },
  };
}
