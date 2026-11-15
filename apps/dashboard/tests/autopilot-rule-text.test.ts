import { expect, test } from "bun:test";

import { toAutopilotRuleText } from "../src/utils/autopilot-rules";

test("a typed topic becomes a rule, a typed rule stays as written", () => {
  expect(toAutopilotRuleText(" dependency bumps. ")).toBe(
    "Never suggest posts about dependency bumps"
  );
  expect(toAutopilotRuleText("Never write about internal tooling")).toBe(
    "Never write about internal tooling"
  );
});

test("a topic that only starts with never still gets the prefix", () => {
  expect(toAutopilotRuleText("never-ending refactors")).toBe(
    "Never suggest posts about never-ending refactors"
  );
});

test("a topic with nothing left after trimming is not a rule", () => {
  expect(toAutopilotRuleText("...")).toBeNull();
  expect(toAutopilotRuleText("  ")).toBeNull();
});
