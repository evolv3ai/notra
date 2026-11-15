import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("chat retains its model across turns, upgrades, and isolates session state", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--no-env-file",
      "--eval",
      `
import assert from "node:assert/strict";
import { mock } from "bun:test";
let sessionId = "thread-1";
const states = new Map();
mock.module("eve", () => ({ defineDynamic: (value) => value }));
mock.module("eve/context", () => ({ defineState: (_key, initial) => ({
  get: () => states.get(sessionId) ?? initial(),
  update: (fn) => states.set(sessionId, fn(states.get(sessionId) ?? initial())),
}) }));
mock.module("@notra/tools/utils/organization", () => ({ getOrganizationId: () => "org-1" }));
let proposed;
let evaluations = 0;
mock.module("eve/experimental/evaluate", () => ({ autoModel: ({ options }) => ({
  events: { "step.started": async () => { evaluations++; return options[proposed]; } },
}) }));
const { createAssistantModel, getSelectedAssistantModelId } = await import("./agent/lib/utils/model.ts");
const { ASSISTANT_FAST_MODEL_ID: fast, ASSISTANT_MODEL_ID: standard, ASSISTANT_DEEP_MODEL_ID: deep, ASSISTANT_TASK_MODEL_ID: task } = await import("./agent/lib/constants/models.ts");
delete process.env.NOTRA_JEV_CLASSIFIERS;
delete process.env.AI_SDK_DEVTOOLS;
const route = createAssistantModel().events["step.started"];
async function select(turnId, candidate, surface = "standalone-chat") {
  proposed = candidate;
  const selected = await route({ data: { turnId } }, {
    session: { id: sessionId, auth: { current: { attributes: { surface } } } },
  });
  assert.equal(getSelectedAssistantModelId(turnId), selected.model.modelId);
  return selected;
}
assert.equal((await select("1", fast)).model.modelId, fast);
assert.equal((await select("2", standard)).model.modelId, standard);
assert.equal((await select("3", fast)).model.modelId, standard);
assert.equal((await select("3", fast)).model.modelId, standard);
assert.equal((await select("4", deep)).model.modelId, deep);
const retained = await select("5", standard);
assert.equal(retained.model.modelId, deep);
assert.equal(retained.reasoning, "high");
assert.equal((await select("6", fast)).model.modelId, deep);

sessionId = "thread-2";
assert.equal((await select("1", fast)).model.modelId, fast);
sessionId = "thread-1";
assert.equal((await select("7", fast)).model.modelId, deep);

for (const flag of ["off", "false", "0"]) {
  process.env.NOTRA_JEV_CLASSIFIERS = flag;
  const before = evaluations;
  assert.equal((await select("disabled-" + flag, deep)).model.modelId, standard);
  assert.equal(evaluations, before);
}
delete process.env.NOTRA_JEV_CLASSIFIERS;
assert.equal((await select("enabled", fast)).model.modelId, standard);
const beforeTask = evaluations;
const taskSelection = await select("task", deep, "task");
assert.equal(taskSelection.model.modelId, task);
assert.equal(taskSelection.reasoning, "low");
assert.equal(evaluations, beforeTask);

sessionId = "retired-model-session";
states.set(sessionId, { turnId: "old", modelId: "retired/model" });
assert.equal((await select("new", fast)).model.modelId, fast);
`,
    ],
    { cwd: resolve(import.meta.dir, ".."), timeout: 30_000 }
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  expect(result.exitCode).toBe(0);
});
