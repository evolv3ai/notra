import { expect, test } from "bun:test";

import {
  hashTrigger,
  scheduleDedupeHashes,
} from "@notra/ai/utils/trigger-hash";
import { configureScheduleBodySchema } from "@notra/schemas/dashboard/integrations";

import { parseTriggerTargets } from "../src/lib/workflows/shared/parsing";
import type { Trigger } from "../src/types/triggers/triggers";
import { getDefaultScheduleValues } from "../src/utils/schedule-form";

test("Linear-only schedules survive validation, persistence parsing and editing", () => {
  const schedule = configureScheduleBodySchema.parse({
    name: "Linear updates",
    sourceType: "cron",
    sourceConfig: { cron: { frequency: "daily", hour: 9, minute: 0 } },
    targets: { repositoryIds: [], linearIntegrationIds: ["team-a"] },
    outputType: "changelog",
    enabled: true,
  });
  const targets = parseTriggerTargets(schedule.targets);
  expect(targets).toEqual(schedule.targets);
  const trigger: Trigger = {
    ...schedule,
    id: "schedule-a",
    organizationId: "org-a",
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
  };
  expect(getDefaultScheduleValues(trigger).repositoryIds).toEqual([
    "linear:team-a",
  ]);
  expect(
    parseTriggerTargets({ repositoryIds: [], linearIntegrationIds: [] })
  ).toBeNull();
});

test("Linear selections participate in deduplication without matching legacy all-Linear schedules", () => {
  const input = {
    sourceType: "cron" as const,
    sourceConfig: { cron: { frequency: "daily" as const, hour: 9, minute: 0 } },
    targets: { repositoryIds: ["repo-a"] },
    outputType: "changelog",
    lookbackWindow: "last_7_days",
  };
  const selected = {
    ...input,
    targets: { ...input.targets, linearIntegrationIds: ["team-b", "team-a"] },
  };
  expect(hashTrigger(selected)).toBe(
    hashTrigger({
      ...selected,
      targets: { ...input.targets, linearIntegrationIds: ["team-a", "team-b"] },
    })
  );
  expect(hashTrigger(selected)).not.toBe(hashTrigger(input));
  expect(hashTrigger(selected)).not.toBe(
    hashTrigger({
      ...input,
      targets: { ...input.targets, linearIntegrationIds: [] },
    })
  );
  expect(scheduleDedupeHashes(selected)).toEqual([hashTrigger(selected)]);
  expect(scheduleDedupeHashes(input)).toHaveLength(2);
  expect(parseTriggerTargets(input.targets)).toEqual(input.targets);
});
