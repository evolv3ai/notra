import {
  MEMORY_PRELOADED_HARD_LIMIT_BYTES,
  MEMORY_PRELOADED_SOFT_LIMIT_BYTES,
} from "@notra/memory/constants/memory";

import type {
  AutopilotScenario,
  AutopilotScenarioOutput,
  ScenarioGroup,
} from "../types/autopilot-planner";
import type { CaseScore, FieldScore } from "../types/eval";

const mean = (values: readonly number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 1;

function field(
  name: string,
  checks: { ok: number; label: string }[],
  expected: string
): FieldScore {
  const failed = checks.filter((check) => check.ok < 1);
  return {
    field: name,
    score: mean(checks.map((check) => check.ok)),
    expected,
    actual: failed.length
      ? failed.map((check) => check.label).join("; ")
      : "all passed",
  };
}

/** Slugs of the final topics that hold any of these observations. */
function topicsHolding(
  output: AutopilotScenarioOutput,
  observations: readonly string[]
) {
  const ids = new Set(observations);
  return output.topics.filter((topic) =>
    topic.observations.some((id) => ids.has(id))
  );
}

function targets(
  output: AutopilotScenarioOutput,
  slug: string | null,
  group: ScenarioGroup | undefined
) {
  if (!(slug && group)) {
    return false;
  }
  const topic = output.topics.find((row) => row.slug === slug);
  const ids = new Set(group.observations);
  return topic?.observations.some((id) => ids.has(id)) ?? false;
}

function linking(output: AutopilotScenarioOutput, testCase: AutopilotScenario) {
  const { groups } = testCase.expected;
  return field(
    "linking",
    groups.map((group) => {
      const holding = topicsHolding(output, group.observations);
      const others = new Set(
        groups
          .filter((row) => row.key !== group.key)
          .flatMap((row) => row.observations)
      );
      const mixed = holding.some((topic) =>
        topic.observations.some((id) => others.has(id))
      );
      const held = new Set(holding[0]?.observations);
      const missing = group.observations.filter((id) => !held.has(id));
      let label = `${group.key} split over ${holding.length} topics`;
      if (mixed) {
        label = `${group.key} shares a topic with another group`;
      } else if (holding.length === 1 && missing.length > 0) {
        label = `${group.key} lost ${missing.join(", ")}`;
      }
      return {
        ok: holding.length === 1 && !mixed && missing.length === 0 ? 1 : 0,
        label,
      };
    }),
    `${groups.length} groups, one topic each`
  );
}

function action(output: AutopilotScenarioOutput, testCase: AutopilotScenario) {
  const { groups, mustActOn } = testCase.expected;
  const checks = testCase.input.runs.map((run, index) => {
    const actual = output.runs[index];
    const group = groups.find((row) => row.key === run.expected.group);
    const typeOk = actual ? run.expected.action.includes(actual.action) : false;
    const topicOk =
      !actual ||
      actual.action === "none" ||
      !group ||
      targets(output, actual.topicSlug, group);
    return {
      ok: typeOk && topicOk ? 1 : 0,
      label: `run ${index + 1}: ${actual?.action ?? "missing"}${actual?.topicSlug ? ` on ${actual.topicSlug}` : ""}, wanted ${run.expected.action.join("|")}`,
    };
  });
  if (mustActOn) {
    const group = groups.find((row) => row.key === mustActOn);
    checks.push({
      ok: output.runs.some(
        (run) => run.action !== "none" && targets(output, run.topicSlug, group)
      )
        ? 1
        : 0,
      label: `never acted on ${mustActOn}`,
    });
  }
  return field(
    "action",
    checks,
    testCase.input.runs.map((run) => run.expected.action.join("|")).join(" → ")
  );
}

function gate(output: AutopilotScenarioOutput, testCase: AutopilotScenario) {
  const checks = testCase.input.runs.map((run, index) => {
    const actual = output.runs[index];
    const open = actual?.gate.open ?? false;
    let ok = 1;
    if (run.expected.pr === "never") {
      ok = open ? 0 : 1;
    } else if (run.expected.pr === "suggest" && open) {
      ok = 0;
    } else if (run.expected.pr === "suggest") {
      ok = actual?.acted === "suggested" ? 1 : 0.5;
    }
    return {
      ok,
      label: `run ${index + 1}: ${open ? "opened" : (actual?.acted ?? "nothing")}, wanted ${run.expected.pr}`,
    };
  });
  const opened = output.runs.filter((run) => run.acted === "opened").length;
  checks.push({
    ok: opened <= testCase.expected.maxPullRequests ? 1 : 0,
    label: `${opened} pull requests opened, max ${testCase.expected.maxPullRequests}`,
  });
  return field(
    "gate",
    checks,
    `≤ ${testCase.expected.maxPullRequests} PRs, ${testCase.input.runs.map((run) => run.expected.pr).join(" → ")}`
  );
}

function rules(output: AutopilotScenarioOutput, testCase: AutopilotScenario) {
  const { excluded = [], forbiddenText = [], groups } = testCase.expected;
  if (
    !(excluded.length || forbiddenText.length || testCase.input.rules.length)
  ) {
    return null;
  }
  const checks: { ok: number; label: string }[] = [];
  const groupsByKey = new Map(groups.map((row) => [row.key, row]));
  for (const rule of excluded) {
    const group = groupsByKey.get(rule.group);
    checks.push({
      ok: output.runs.some(
        (run) => run.action !== "none" && targets(output, run.topicSlug, group)
      )
        ? 0
        : 1,
      label: `acted on excluded ${rule.group}`,
    });
    const holding = topicsHolding(output, group?.observations ?? []);
    checks.push({
      ok:
        holding.length > 0 &&
        holding.every((topic) => topic.status === rule.status)
          ? 1
          : 0,
      label: `${rule.group} is ${holding.map((topic) => topic.status).join(",") || "missing"}, wanted ${rule.status}`,
    });
  }
  const written = output.topics
    .map((topic) => topic.summary)
    .join("\n")
    .toLowerCase();
  for (const text of forbiddenText) {
    checks.push({
      ok: written.includes(text.toLowerCase()) ? 0 : 1,
      label: `memory repeats "${text}"`,
    });
  }
  if (testCase.input.rules.length) {
    checks.push({
      ok: output.rulesUnchanged ? 1 : 0,
      label: "rules.md changed",
    });
  }
  return field(
    "rules",
    checks,
    excluded.map((rule) => `${rule.group} ${rule.status}`).join(", ") ||
      "rules respected"
  );
}

/** Follow-up runs reuse a topic's slug instead of starting a duplicate. */
function stability(
  output: AutopilotScenarioOutput,
  testCase: AutopilotScenario
) {
  const { groups } = testCase.expected;
  const seeded = groups.filter((group) => group.slug);
  if (!(seeded.length || testCase.input.runs.length > 1)) {
    return null;
  }
  const checks = seeded.map((group) => {
    const holding = topicsHolding(output, group.observations);
    return {
      ok: holding.length === 1 && holding[0]?.slug === group.slug ? 1 : 0,
      label: `${group.key} in ${holding.map((topic) => topic.slug).join(",") || "nothing"}, wanted ${group.slug}`,
    };
  });
  const expected =
    testCase.input.topics.length + groups.filter((group) => !group.slug).length;
  checks.push({
    ok: output.topics.length <= expected ? 1 : 0,
    label: `${output.topics.length} topics, expected at most ${expected}`,
  });
  return field(
    "stability",
    checks,
    seeded.map((group) => group.slug).join(", ") || "no duplicate topics"
  );
}

function sizeScore(bytes: number) {
  if (bytes <= MEMORY_PRELOADED_SOFT_LIMIT_BYTES) {
    return 1;
  }
  return bytes <= MEMORY_PRELOADED_HARD_LIMIT_BYTES ? 0.5 : 0;
}

/** planner.md stays small enough to preload, and every open topic says what it is. */
function memory(output: AutopilotScenarioOutput) {
  const checks = output.runs.map((run, index) => ({
    ok: sizeScore(run.plannerBytes),
    label: `run ${index + 1} planner.md is ${run.plannerBytes} B`,
  }));
  for (const topic of output.topics) {
    if (topic.status !== "done" && topic.status !== "dismissed") {
      checks.push({
        ok: topic.summary.trim() ? 1 : 0,
        label: `${topic.slug} has no summary`,
      });
    }
  }
  return field(
    "memory",
    checks,
    `planner.md ≤ ${MEMORY_PRELOADED_SOFT_LIMIT_BYTES} B, summaries`
  );
}

/**
 * Passing means the decisions were right: topics linked, the expected action
 * per run, no forbidden pull request and every rule kept. Memory size and
 * slug reuse only move the score.
 */
export function scorePlannerScenario(
  output: AutopilotScenarioOutput,
  testCase: AutopilotScenario
): CaseScore {
  const fields = [
    linking(output, testCase),
    action(output, testCase),
    gate(output, testCase),
    rules(output, testCase),
    stability(output, testCase),
    memory(output),
  ].filter((item): item is FieldScore => item !== null);
  const decisive = fields.filter((item) =>
    ["linking", "action", "gate", "rules"].includes(item.field)
  );
  return {
    score: mean(fields.map((item) => item.score)),
    pass: decisive.every((item) => item.score === 1),
    fields,
  };
}
