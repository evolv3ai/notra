import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("the Autopilot rules cleanup drops only the unused rules table", () => {
  const prior = JSON.parse(
    readFileSync(
      new URL("../migrations/meta/0129_snapshot.json", import.meta.url),
      "utf8"
    )
  );
  const current = JSON.parse(
    readFileSync(
      new URL("../migrations/meta/0130_snapshot.json", import.meta.url),
      "utf8"
    )
  );
  const migration = readFileSync(
    new URL("../migrations/0130_remove_autopilot_rules.sql", import.meta.url),
    "utf8"
  );
  expect(current.prevId).toBe(prior.id);
  expect(prior.tables["public.autopilot_rules"]).toBeDefined();
  delete prior.tables["public.autopilot_rules"];
  expect(current).toEqual({
    ...prior,
    id: current.id,
    prevId: prior.id,
  });
  expect(migration.trim()).toBe('DROP TABLE "autopilot_rules" CASCADE;');
});
