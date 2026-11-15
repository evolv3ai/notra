import { describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

function runNativeCancellation(scenario: string) {
  const runtime = realpathSync(
    resolve(import.meta.dir, "../node_modules/eve/dist/src")
  );
  const result = Bun.spawnSync([
    process.execPath,
    "--eval",
    `
import { mock } from "bun:test";
import assert from "node:assert/strict";
const runtime = ${JSON.stringify(runtime)};
const native = (path) => runtime + "/" + path + ".js";
const cancelledTasks = [];
let cancelledDescendants = 0;
let step;
mock.module(native("execution/session/turn-step"), () => ({ turnStep: (input) => step(input) }));
mock.module(native("execution/cancel-descendant-turns-step"), () => ({ cancelDescendantTurnsStep: async () => { cancelledDescendants++; } }));
mock.module(native("execution/coordination-dispatch-step"), () => ({ dispatchCoordinationStep: async () => { throw Error("Unexpected coordination"); } }));
mock.module(native("execution/tasks/parent/delegate"), () => ({ acknowledgeDelegatedTasksStep: async () => {} }));
mock.module(native("execution/session-workflow-tool-run"), () => ({ handleWorkflowToolRunMessage: async () => {} }));
mock.module(native("execution/session/route-selected-delivery"), () => ({ routeSelectedDelivery: async () => { throw Error("Unexpected steering"); } }));
mock.module(native("execution/route-child-delivery"), () => ({ routeDeliverToChildren: async () => { throw Error("Unexpected child delivery"); } }));
mock.module(native("subagents/event-proxy-step"), () => ({ runProxySubagentEventStep: async () => {} }));
const { ContextKey } = await import(native("context/key"));
const bundleKey = new ContextKey("eve.bundle");
mock.module(native("runtime/sessions/runtime-context-keys"), () => ({ BundleKey: bundleKey }));
const { ContextContainer } = await import(native("context/container"));
mock.module(native("context/serialize"), () => ({ deserializeContext: async () => {
  const ctx = new ContextContainer();
  ctx.set(bundleKey, { turnAgent: {}, resolvedAgent: {} });
  return ctx;
} }));
mock.module(native("execution/session"), () => ({ hydrateDurableSession: ({ durable }) => durable, projectToDurableSession: (session) => session }));
mock.module(native("execution/tasks/parent/dispatch"), () => ({ cancelOwnedTask: async ({ entry }) => { cancelledTasks.push(entry.taskId); } }));
mock.module(native("execution/tools/subagent/task-cancel"), () => ({ cancelBackgroundAgentTask: async () => {} }));

const { SessionExecution } = await import(native("execution/session/turn"));
const { SessionInputQueue } = await import(native("execution/session/input-queue"));
const { getSessionTaskCohorts } = await import(native("tasks/session-task-cohorts"));
const { nextTurnDelivery } = await import(native("execution/session/next-input"));
const { applySessionCancellation } = await import(native("execution/session/admission"));
const { ActivityObserverKey, ActivityRootTurnIdKey } = await import(native("context/keys"));

function task(taskId, createdByTurnId, rootTurnId) {
  return {
    taskId, createdByTurnId, taskInboxToken: "inbox:" + taskId, taskRunId: "run:" + taskId,
    metadata: { kind: "tool", name: taskId },
    ...(rootTurnId === undefined ? {} : { activityWorkIdentity: {
      id: taskId, kind: "task", rootSessionId: "session-1", rootTurnId,
    } }),
  };
}
function fixture({ tasks = [], rootTurnId = "old-root", state = {} } = {}) {
  const pending = [];
  let interrupt;
  const inbox = {
    next: async () => pending.shift(), drain: () => pending.splice(0), hasPending: () => pending.length > 0,
    onInterrupt: (handler) => { interrupt = handler; return () => { interrupt = undefined; }; },
    onDelivery: () => () => {},
    push: (command) => { pending.push(command); interrupt?.(command); },
  };
  const cursor = {
    serializedContext: { [ActivityObserverKey.name]: {}, [ActivityRootTurnIdKey.name]: rootTurnId },
    sessionState: {
      version: 1, sessionId: "session-1", continuationToken: "session:1", hasProxyInputRequests: false,
      emissionState: { sessionStarted: true, sequence: 9, stepIndex: 0, turnId: "" },
      snapshot: { session: {
        sessionId: "session-1", continuationToken: "session:1", agent: { system: "" }, history: [],
        state: { ...state, "eve.tasks": { version: 2, tasks } },
      } },
    },
    apply: async (transition) => Object.assign(cursor, transition),
    createStepInput: (input, signals) => ({ input, ...signals, serializedContext: cursor.serializedContext, sessionState: cursor.sessionState }),
  };
  const queue = new SessionInputQueue();
  const execution = new SessionExecution({ cursor, inbox, queue, mode: "conversation", sessionId: "session-1" });
  return { cursor, inbox, queue, execution };
}
function parkedResult(input) {
  return { action: "park", hasPendingAuthorization: false, hasPendingInputBatch: false,
    serializedContext: input.serializedContext, sessionState: input.sessionState };
}
${scenario}
`,
  ]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
}

describe("Eve native scoped cancellation", () => {
  test("cancels a resumed task cohort by its activity root before the first step commits", () => {
    runNativeCancellation(`
const f = fixture({ tasks: [task("original", "old-root", "old-root"), task("continued", "turn_8", "old-root"), task("later", "new-root", "new-root")] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "old-root" });
  assert.equal(input.abortSignal.aborted, true);
  return parkedResult(input);
};
const result = await f.execution.runTurn({ delivery: { kind: "deliver", taskDeliveryId: "continued:terminal", payloads: [{ message: "Task finished" }] } });
assert.equal(result.cancelled, true);
assert.equal(cancelledDescendants, 1);
assert.deepEqual(cancelledTasks, ["original", "continued"]);
`);
  });

  test("accepts the actual execution turn and only cancels its task work", () => {
    runNativeCancellation(`
const f = fixture({ tasks: [task("original", "old-root", "old-root"), task("current", "turn_9", "old-root"), task("later", "new-root", "new-root")] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "turn_9" });
  assert.equal(input.abortSignal.aborted, true);
  return parkedResult(input);
};
assert.equal((await f.execution.runTurn()).cancelled, true);
assert.deepEqual(cancelledTasks, ["current"]);
`);
  });

  test("accepts a non-primary origin root in a fully completed coalesced continuation", () => {
    runNativeCancellation(`
const first = task("first", "root-0", "root-0"), second = { ...task("second", "root-1", "root-1"), cohortId: "first" };
for (const entry of [first, second]) entry.terminalView = { taskId: entry.taskId, metadata: entry.metadata, status: "completed", lastOutput: { type: "result", data: "done" } };
const f = fixture({ rootTurnId: "root-7", tasks: [first, second, task("later", "root-7", "root-7")] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "root-1" });
  assert.equal(input.abortSignal.aborted, true);
  return parkedResult(input);
};
for (const entry of [first, second]) f.queue.enqueueDelivery({ kind: "deliver", taskDeliveryId: entry.taskId + ":ready:completed", payloads: [{ message: "done", task: { views: [entry.terminalView] } }] });
const selection = f.queue.takeNext(getSessionTaskCohorts(f.cursor.sessionState.snapshot.session.state));
assert.equal(selection.delivery.payloads.length, 2);
const result = await f.execution.runTurn({ delivery: selection.delivery });
assert.equal(result.cancelled, true);
assert.deepEqual(cancelledTasks, ["second"]);
`);
  });

  test("does not treat an unfinished overlapping origin as part of the current foreground continuation", () => {
    runNativeCancellation(`
const first = task("first", "root-0", "root-0"), second = { ...task("second", "root-1", "root-1"), cohortId: "first" };
first.terminalView = { taskId: first.taskId, metadata: first.metadata, status: "completed", lastOutput: { type: "result", data: "done" } };
const f = fixture({ rootTurnId: "root-0", tasks: [first, second] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "root-1" });
  assert.equal(input.abortSignal.aborted, false);
  return parkedResult(input);
};
const result = await f.execution.runTurn({ delivery: { kind: "deliver", taskDeliveryId: "first:ready:completed", payloads: [{ message: "done", task: { views: [first.terminalView] } }] } });
assert.equal(result.cancelled, undefined);
assert.deepEqual(cancelledTasks, ["second"]);
`);
  });

  test("a new foreground turn does not inherit an earlier coalesced cancellation scope", () => {
    runNativeCancellation(`
const f = fixture({ rootTurnId: "root-0", tasks: [task("older", "root-1", "root-1"), task("later", "turn_9", "turn_9")] });
f.cursor.serializedContext["eve.activityTaskRootTurnIds"] = ["root-0", "root-1"];
f.cursor.serializedContext["eve.turnTaskDelivery"] = "settled";
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "root-1" });
  assert.equal(input.abortSignal.aborted, false);
  return { ...parkedResult(input), serializedContext: { ...input.serializedContext, [ActivityRootTurnIdKey.name]: "turn_9" } };
};
const result = await f.execution.runTurn({ delivery: { kind: "deliver", payloads: [{ message: "New request" }] } });
assert.equal(result.cancelled, undefined);
assert.deepEqual(cancelledTasks, ["older"]);
`);
  });

  test("restores an approval cohort instead of using the last serialized root", () => {
    runNativeCancellation(`
const f = fixture({ rootTurnId: "new-root", state: {
  "eve.runtime.pendingInputBatches": [{ activityRootTurnId: "old-root", requests: [{ requestId: "approval-1" }], responseMessages: [] }],
} });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "old-root" });
  assert.equal(input.abortSignal.aborted, true);
  return parkedResult(input);
};
const result = await f.execution.runTurn({ delivery: { kind: "deliver", payloads: [{ inputResponses: [{ requestId: "approval-1", response: "approve" }] }] } });
assert.equal(result.cancelled, true);
`);
  });

  test("does not abort a new foreground turn when an older background cohort is cancelled", () => {
    runNativeCancellation(`
const f = fixture({ tasks: [task("original", "old-root", "old-root"), task("continued", "turn_8", "old-root"), task("later", "turn_9", "turn_9")] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "old-root" });
  assert.equal(input.abortSignal.aborted, false);
  return { ...parkedResult(input), serializedContext: { ...input.serializedContext, [ActivityRootTurnIdKey.name]: "turn_9" } };
};
const result = await f.execution.runTurn({ delivery: { kind: "deliver", payloads: [{ message: "A new request" }] } });
assert.equal(result.cancelled, undefined);
assert.equal(cancelledDescendants, 0);
assert.deepEqual(cancelledTasks, ["original", "continued"]);
`);
  });

  test("restores the matching authorization cohort before its first step commits", () => {
    runNativeCancellation(`
const f = fixture({ rootTurnId: "new-root", state: {
  "eve.runtime.pendingAuthorization": {
    challenges: [{ name: "connection-1", attemptId: "attempt-1", principal: {}, challenge: {}, hookUrl: "http://localhost" }],
    activityRootTurnIds: { "attempt-1": "old-root" },
  },
} });
step = async (input) => {
  f.inbox.push({ kind: "cancel", turnId: "old-root" });
  assert.equal(input.abortSignal.aborted, true);
  return parkedResult(input);
};
const result = await f.execution.runTurn({ delivery: { kind: "deliver", payloads: [{ authorizationCallback: { connectionName: "connection-1", attemptId: "attempt-1", callback: {} } }] } });
assert.equal(result.cancelled, true);
`);
  });

  test("does not abort a different resumed foreground cohort", () => {
    runNativeCancellation(`
const f = fixture({ rootTurnId: "old-root", tasks: [task("original", "old-root", "old-root"), task("later", "new-root", "new-root")] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "old-root" });
  assert.equal(input.abortSignal.aborted, false);
  return { ...parkedResult(input), serializedContext: { ...input.serializedContext, [ActivityRootTurnIdKey.name]: "new-root" } };
};
const result = await f.execution.runTurn({ delivery: { kind: "deliver", taskDeliveryId: "later:terminal", payloads: [{ message: "Task finished" }] } });
assert.equal(result.cancelled, undefined);
assert.equal(cancelledDescendants, 0);
assert.deepEqual(cancelledTasks, ["original"]);
`);
  });

  for (const turnId of ["old-root", "unknown-root"]) {
    test(`parked cancellation for ${turnId} never touches later task work`, () => {
      runNativeCancellation(`
const f = fixture({ rootTurnId: "new-root", tasks: [task("legacy", "old-root"), task("continued", "turn_8", "old-root"), task("later", "new-root", "new-root")] });
f.inbox.push({ kind: "cancel", tasks: true, turnId: ${JSON.stringify(turnId)} });
assert.deepEqual(await nextTurnDelivery(f), { kind: "closed" });
assert.deepEqual(cancelledTasks, ${JSON.stringify(turnId === "old-root" ? ["legacy", "continued"] : [])});
assert.equal(cancelledDescendants, 0);
`);
    });
  }

  test("an unknown scope is harmless during an active turn", () => {
    runNativeCancellation(`
const f = fixture({ tasks: [task("later", "turn_9", "turn_9")] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true, turnId: "unknown-root" });
  assert.equal(input.abortSignal.aborted, false);
  return parkedResult(input);
};
assert.equal((await f.execution.runTurn({ delivery: { kind: "deliver", payloads: [{ message: "New request" }] } })).cancelled, undefined);
assert.deepEqual(cancelledTasks, []);
`);
  });

  test("unscoped text cancellation still aborts the foreground and cancels all session tasks", () => {
    runNativeCancellation(`
const f = fixture({ tasks: [task("original", "old-root", "old-root"), task("later", "new-root", "new-root")] });
step = async (input) => {
  f.inbox.push({ kind: "cancel", tasks: true });
  assert.equal(input.abortSignal.aborted, true);
  return parkedResult(input);
};
assert.equal((await f.execution.runTurn()).cancelled, true);
assert.deepEqual(cancelledTasks, ["original", "later"]);
assert.equal(cancelledDescendants, 1);
`);
  });

  test("unscoped parked cancellation still cancels all session tasks", () => {
    runNativeCancellation(`
const f = fixture({ tasks: [task("original", "old-root", "old-root"), task("later", "new-root", "new-root")] });
f.inbox.push({ kind: "cancel", tasks: true });
assert.deepEqual(await nextTurnDelivery(f), { kind: "closed" });
assert.deepEqual(cancelledTasks, ["original", "later"]);
`);
  });

  test("a task-specific cancellation also respects a supplied turn scope", () => {
    runNativeCancellation(`
const f = fixture({ tasks: [task("later", "new-root", "new-root")] });
await applySessionCancellation({ kind: "cancel", turnId: "old-root", taskId: "later" }, f);
assert.equal(f.queue.isTaskCancelled("later"), false);
await applySessionCancellation({ kind: "cancel", turnId: "new-root", taskId: "later" }, f);
assert.equal(f.queue.isTaskCancelled("later"), true);
`);
  });
});
