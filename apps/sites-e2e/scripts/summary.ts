import { readFileSync } from "node:fs";

import type { LifecycleJournalReport } from "../tests/types/lifecycle-journal";

// Renders a Sites E2E report as Markdown for the GitHub job summary:
//   bun apps/sites-e2e/scripts/summary.ts lifecycle artifacts/dashboard.json
//   bun apps/sites-e2e/scripts/summary.ts browser artifacts/benchmarks.json
const [kind, path] = process.argv.slice(2);
if ((kind !== "lifecycle" && kind !== "browser") || !path) {
  throw new Error("usage: summary.ts <lifecycle|browser> <report.json>");
}
const report = JSON.parse(readFileSync(path, "utf8"));
const lines: string[] = [];
const mark = (passed: boolean) => (passed ? "✅" : "❌");
const seconds = (ms: number | undefined) =>
  ms === undefined ? "–" : `${(ms / 1000).toFixed(1)} s`;
// Keeps table cells on one line and pipes from splitting columns.
const cell = (text: unknown) =>
  String(text ?? "")
    .split("\n")[0]
    ?.replaceAll("|", "\\|")
    .slice(0, 300);

if (kind === "lifecycle") {
  const passed = report.passed && report.cleanupPassed;
  lines.push(
    `${mark(passed)} **${passed ? "Passed" : "Failed"}** in ${seconds(report.durationMs)} · builds: ${report.boxBuildsTested ? "real Upstash Box" : "Box emulator"}`
  );
  if (report.boxSnapshot) {
    lines.push(
      `Box snapshot \`${report.boxSnapshot.snapshotId}\` (${report.boxSnapshot.version}): ${report.boxSnapshot.deleted ? "deleted" : "**not deleted**"}; stale test snapshots removed: ${report.staleBoxSnapshotsRemoved}`
    );
  }
  if (report.errors?.length) {
    lines.push("", "**Errors**", "");
    for (const error of report.errors) {
      lines.push(`- ${cell(error)}`);
    }
  }
  const suites = (report.databaseRegressions ?? []) as {
    file: string;
    passed: boolean;
    durationMs: number;
    tests?: { pass: number; fail: number; skip: number };
    failedTests?: string[];
  }[];
  if (suites.length) {
    lines.push(
      "",
      "**PostgreSQL suites**",
      "",
      "| | Suite | Pass | Fail | Skip | Time |",
      "| --- | --- | ---: | ---: | ---: | ---: |"
    );
    for (const suite of suites) {
      lines.push(
        `| ${mark(suite.passed)} | \`${suite.file}\` | ${suite.tests?.pass ?? "–"} | ${suite.tests?.fail ?? "–"} | ${suite.tests?.skip ?? "–"} | ${seconds(suite.durationMs)} |`
      );
    }
    for (const suite of suites.filter((entry) => entry.failedTests?.length)) {
      lines.push("", `Failed in \`${suite.file}\`:`);
      for (const test of suite.failedTests ?? []) {
        lines.push(`- ${cell(test)}`);
      }
    }
  }
  const lifecycle = report.lifecycle as LifecycleJournalReport | null;
  if (lifecycle) {
    lines.push(
      "",
      `**Connected lifecycle** (${lifecycle.builder}, ${lifecycle.webhookDeliveries} webhook deliveries)`,
      "",
      "| | Step | Builds | Time |",
      "| --- | --- | ---: | ---: |"
    );
    for (const phase of lifecycle.phases) {
      lines.push(
        `| ${mark(phase.status === "passed")} | ${phase.name} | ${phase.builds} | ${seconds(phase.durationMs)} |`
      );
    }
    if (lifecycle.runningPhase) {
      lines.push(`| ⏱️ | ${lifecycle.runningPhase} (stopped here) | | |`);
    }
    if (lifecycle.error) {
      lines.push(
        "",
        `Failed in **${lifecycle.failedPhase}**:`,
        "",
        "```",
        lifecycle.error,
        "```"
      );
    }
    if (lifecycle.builds.length) {
      lines.push(
        "",
        "<details><summary>Builds (failed ones in the broken-push steps are expected)</summary>",
        "",
        "| Result | Step | Time | Sandbox | Error |",
        "| --- | --- | ---: | --- | --- |"
      );
      for (const build of lifecycle.builds) {
        lines.push(
          `| ${build.ok ? "built" : "failed"} | ${build.phase} | ${seconds(build.durationMs)} | ${build.sandboxId ? `\`${build.sandboxId}\`` : "–"} | ${cell(build.error) || "–"} |`
        );
      }
      lines.push("", "</details>");
    }
  }
  if (lifecycle?.emulators?.length) {
    lines.push(
      "",
      "<details><summary>Emulated providers</summary>",
      "",
      "| | Provider | Requests | Routes |",
      "| --- | --- | ---: | --- |"
    );
    for (const service of lifecycle.emulators) {
      const routes = Object.entries(service.routes)
        .map(([route, count]) => `\`${route}\` ×${count}`)
        .join("<br>");
      lines.push(
        `| ${mark(service.unhandled.length === 0)} | ${service.service} | ${service.requests} | ${routes || "–"} |`
      );
    }
    for (const service of lifecycle.emulators.filter(
      (entry) => entry.unhandled.length
    )) {
      lines.push("", `Unemulated calls to **${service.service}**:`);
      for (const call of service.unhandled) {
        lines.push(`- \`${cell(call)}\``);
      }
    }
    lines.push("", "</details>");
  }
  if (report.checks) {
    lines.push(
      "",
      `${mark(true)} Dashboard HTTP checks: test-status route, header spoofing blocked, dev session.`
    );
  }
  lines.push("", "Logs for every suite are in the job artifact under `logs/`.");
} else {
  const passed = report.status === "passed";
  lines.push(`${mark(passed)} **${report.status}** (exit ${report.exitCode})`);
  if (!passed) {
    lines.push(
      "",
      `Failed after: **${report.failedAfter ?? "unknown"}**${report.failedUrl ? ` on \`${report.failedUrl}\`` : ""}`,
      "",
      "```",
      String(report.error ?? "no error recorded").slice(0, 3000),
      "```"
    );
    if (report.workerErrors?.length) {
      lines.push("", "Worker log errors:", "");
      for (const error of report.workerErrors) {
        lines.push(`- ${cell(error)}`);
      }
    }
    if (report.failureScreenshot) {
      lines.push("", "The artifact has `failure.png` of the page at failure.");
    }
  }
  const checks = (report.checks ?? []) as string[];
  if (checks.length) {
    lines.push(
      "",
      `<details><summary>${checks.length} checks passed</summary>`,
      ""
    );
    for (const check of checks) {
      lines.push(`- ${cell(check)}`);
    }
    lines.push("", "</details>");
  }
  const summary = Object.entries(report.summary ?? {}) as [
    string,
    { count: number; medianMs: number; p95Ms: number; maxMs: number },
  ][];
  // Compiler, navigation and beacon timings up front; per-provider timings
  // collapsed.
  const table = (rows: typeof summary) => [
    "| Measurement | Runs | Median | p95 | Max |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows.map(
      ([name, value]) =>
        `| ${name} | ${value.count} | ${Math.round(value.medianMs)} ms | ${Math.round(value.p95Ms)} ms | ${Math.round(value.maxMs)} ms |`
    ),
  ];
  const primary = summary.filter(([name]) => !/^(simulated|live)\./.test(name));
  const providers = summary.filter(([name]) =>
    /^(simulated|live)\./.test(name)
  );
  if (primary.length) {
    lines.push("", ...table(primary));
  }
  if (providers.length) {
    lines.push(
      "",
      "<details><summary>Provider script timings</summary>",
      "",
      ...table(providers),
      "",
      "</details>"
    );
  }
  if (report.providerRequests) {
    lines.push(
      "",
      `Provider requests (${report.vendorScripts ?? "emulated"} scripts): ${report.providerRequests.length}; Notra ingest: ${report.internalIngestCounts?.traffic ?? 0} page views, ${report.internalIngestCounts?.engagement ?? 0} engagement events.`
    );
  }
  if (report.cleanup) {
    lines.push(
      `${mark(report.cleanup.passed)} Cleanup: ${report.cleanup.passed ? "processes, port and temp files gone" : report.cleanup.errors.join("; ")}`
    );
  }
}
process.stdout.write(`${lines.join("\n")}\n`);
