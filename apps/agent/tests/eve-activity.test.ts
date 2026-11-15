import { describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

function runNativeActivity(scenario: string) {
  const runtime = realpathSync(
    resolve(import.meta.dir, "../node_modules/eve/dist/src")
  );
  const result = Bun.spawnSync([
    process.execPath,
    "--eval",
    `
import { mock } from "bun:test";
import assert from "node:assert/strict";
const native = (path) => ${JSON.stringify(runtime)} + "/" + path + ".js";
mock.module(native("execution/submit-activity"), () => ({ submitActivity: async ({ events }) => reduce(events) }));
const { recordSessionTask, cacheTerminalTaskView, getSessionTaskIndex } = await import(native("tasks/session-index"));
const { getSessionTaskCohorts, getTaskCohortId } = await import(native("tasks/session-task-cohorts"));
const { SessionInputQueue } = await import(native("execution/session/input-queue"));
const { resolveTaskDeliveryContext, settledTaskActivityRootTurnIds } = await import(native("tasks/delivery-context"));
const { observeSessionActivity, projectSessionActivity } = await import(native("execution/session-activity-projection"));
const { updateActivityRootForDelivery } = await import(native("execution/activity-cohort"));
const { createActivitySnapshot, reduceActivityBatch } = await import(native("execution/session-activity"));
const { projectTaskActivity } = await import(native("execution/tasks/child/steps"));
const { deriveRootTurnWorkIdentity, deriveBackgroundTaskActivityObserver } = await import(native("execution/activity-work"));
const { selectSlackActivityStatus } = await import(native("public/channels/slack/activity"));
const { ContextContainer, contextStorage } = await import(native("context/container"));
const { appendPendingInputBatch } = await import(native("harness/pending-input-batches"));
const { setPendingAuthorization } = await import(native("harness/authorization"));
const { BackgroundToolExecutorKey } = await import(native("harness/background-tools"));
const { ActivityObserverKey, ActivityRootTurnIdKey, ActivityTaskRootTurnIdsKey, ActivitySettledTaskRootTurnIdsKey, TurnTaskDeliveryKey } = await import(native("context/keys"));
const sink = { version: 1, url: "http://localhost/unused" };
let session = { state: {} }, snapshot = createActivitySnapshot();
const queue = new SessionInputQueue(), observers = new Map();
const ctx = new ContextContainer();
ctx.set(ActivityObserverKey, { sink });
function reduce(events) { snapshot = reduceActivityBatch(snapshot, { version: 1, events }); }
function event(type, turnId, data = {}) {
  return { type, data: { turnId, sequence: 2, ...data }, meta: { at: "2026-10-13T12:04:00.000Z", id: type + ":" + turnId } };
}

function root(turnId) { return deriveRootTurnWorkIdentity({ sessionId: "session-1", turn: { id: turnId } }); }
function startRoot(turnId) {
  reduce(projectSessionActivity({ sessionId: "session-1", rootTurnId: turnId, event: event("turn.started", turnId) }));
}
function launch(taskId, turnId) {
  const metadata = { kind: "subagent", name: taskId };
  const observer = deriveBackgroundTaskActivityObserver({ activityObserver: { sink, workIdentity: root(turnId) }, parentSessionId: "session-1", rootSessionId: "session-1", parentTurnId: turnId, callId: taskId, name: taskId });
  observers.set(taskId, observer);
  session = recordSessionTask(session, { taskId, createdByTurnId: turnId, taskInboxToken: "inbox:" + taskId, taskRunId: "run:" + taskId, metadata, activityWorkIdentity: observer.workIdentity });
  startRoot(turnId);
  reduce(projectTaskActivity({ activityObserver: observer, settledAt: "2026-10-13T12:02:00.000Z", view: { metadata, taskId, status: "working" } }));
  reduce(projectSessionActivity({ sessionId: "session-1", rootTurnId: turnId, suppressRootSettlement: true, event: event("turn.completed", turnId) }));
}
function complete(taskId) {
  const entry = getSessionTaskIndex(session.state).find((task) => task.taskId === taskId);
  const view = { taskId, metadata: entry.metadata, status: "completed", lastOutput: { type: "result", data: "done" } };
  session = { ...session, state: cacheTerminalTaskView(session.state, view) };
  reduce(projectTaskActivity({ activityObserver: observers.get(taskId), settledAt: "2026-10-13T12:03:00.000Z", view }));
  queue.enqueueDelivery({ kind: "deliver", taskDeliveryId: taskId + ":ready:completed", payloads: [{ message: "done", task: { views: [view] } }] });
}
function prepare(delivery) {
  const taskContext = resolveTaskDeliveryContext({ state: session.state, taskDeliveryId: delivery.taskDeliveryId });
  ctx.set(TurnTaskDeliveryKey, taskContext.phase);
  ctx.set(ActivityTaskRootTurnIdsKey, taskContext.rootTurnIds);
  ctx.set(ActivitySettledTaskRootTurnIdsKey, taskContext.settledRootTurnIds);
  updateActivityRootForDelivery({ activeTurnId: "turn_2", ctx, delivery, sessionState: session.state, taskRootTurnId: taskContext.rootTurnId });
  return taskContext;
}
async function report() {
  const selection = queue.takeNext(getSessionTaskCohorts(session.state));
  assert.equal(selection.kind, "turn");
  const taskContext = prepare(selection.delivery);
  await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.completed", "turn_2") });
  return { selection, taskContext };
}
function phase(turnId) { return snapshot.work[root(turnId).id]?.phase; }
launch("task-0", "turn_0");
launch("task-1", "turn_1");
assert.equal(getTaskCohortId(getSessionTaskIndex(session.state)[0]), getTaskCohortId(getSessionTaskIndex(session.state)[1]));
${scenario}
`,
  ]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
}

function runNativeRetirement(
  scenario: string,
  expectRenderFailureLogs = false
) {
  const runtime = realpathSync(
    resolve(import.meta.dir, "../node_modules/eve/dist/src")
  );
  const result = Bun.spawnSync([
    process.execPath,
    "--eval",
    `
import { mock } from "bun:test";
import assert from "node:assert/strict";
const native = (path) => ${JSON.stringify(runtime)} + "/" + path + ".js";
const token = "native-activity-retirement-fixture-token", queued = [], timers = [];
let waiting, closed = false, rendered = 0, disposed = 0, finalRendererState, finalRendererSnapshot, disposalGate, providerStatus = "", renderFailures = 0;
let resolveClosed, resolveDisposalStarted;
const hookClosed = new Promise((resolve) => { resolveClosed = resolve; });
const disposalStarted = new Promise((resolve) => { resolveDisposalStarted = resolve; });
let resolveDebounce, resolveRendered;
const debounce = () => new Promise((resolve) => { resolveDebounce = resolve; });
const renderedOnce = new Promise((resolve) => { resolveRendered = resolve; });
let debounceStarted = debounce();
const hook = {
  token, getConflict: async () => null,
  dispose: () => { closed = true; waiting?.({ done: true }); waiting = undefined; resolveClosed(); },
  [Symbol.asyncIterator]: () => ({ next: () => queued.length ? Promise.resolve({ value: queued.shift(), done: false }) : closed ? Promise.resolve({ done: true }) : new Promise((resolve) => { waiting = resolve; }) }),
};
mock.module(native("compiled/@workflow/core/index"), () => ({
  createHook: () => hook,
  sleep: (value) => new Promise((resolve) => { if (typeof value === "number") { timers.push(resolve); resolveDebounce?.(); } }),
}));
mock.module(native("internal/workflow/runtime"), () => ({ resumeHook: async (requestedToken, batch) => {
  assert.equal(requestedToken, token);
  if (closed) throw Error("Collector closed");
  if (waiting) { const resolve = waiting; waiting = undefined; resolve({ value: batch, done: false }); } else queued.push(batch);
  return { runId: "collector" };
} }));
mock.module(native("execution/workflow-runtime"), () => ({ waitForHookRelease: async (requestedToken, ownerRunId) => {
  assert.equal(requestedToken, token); assert.equal(ownerRunId, "collector"); await hookClosed;
} }));
const { ContextKey } = await import(native("context/key"));
const BundleKey = new ContextKey("eve.bundle"), ChannelKey = new ContextKey("eve.channel");
mock.module(native("runtime/sessions/runtime-context-keys"), () => ({ BundleKey, ChannelKey }));
mock.module(native("instrumentation/runtime"), () => ({ bindSessionInstrumentation: () => undefined }));
mock.module(native("channel/adapter"), () => ({ callAdapterEventHandler: async (_adapter, event) => event }));
mock.module(native("channel/adapter-context"), () => ({ buildAdapterContext: () => ({ state: {} }) }));
mock.module(native("execution/terminate-child-sessions-step"), () => ({ terminateChildSessionsStep: async () => {} }));
mock.module(native("subagents/parent-notification"), () => ({ notifyDelegatedParentStep: async () => {}, notifyTurnCallerStep: async () => {}, bindTurnCallerContextStep: async () => {}, notifyCancelledTaskCallerStep: async () => {}, resolveInitialTurnCallerStep: async () => {} }));
mock.module(native("subagents/callback-step"), () => ({ fireSessionCallbackStep: async () => {} }));
mock.module(native("subagents/parent-result"), () => ({ createDelegatedSubagentErrorResult: () => {}, createDelegatedSubagentSuccessResult: () => {} }));
mock.module(native("execution/terminal-session-failure-step"), () => ({ emitTerminalSessionFailureStep: async () => { throw Error("Unexpected failure step"); } }));
const { ContextContainer } = await import(native("context/container"));
const { ActivityObserverKey, ParentSessionKey } = await import(native("context/keys"));
const { attachChannelActivityPresentation } = await import(native("channel/activity-renderer"));
const { buildSlackActivityRenderers, experimental_slackActivityRenderer } = await import(native("public/channels/slack/activity"));
const adapter = { kind: "fixture", state: {} };
const renderer = experimental_slackActivityRenderer({
  id: "fixture",
  render: async () => { rendered++; providerStatus = "Working…"; resolveRendered(); if (renderFailures-- > 0) throw Error("Fixture render failed after committing a card"); return { card: "working", status: "Working…" }; },
  dispose: async ({ state, snapshot }) => { disposed++; resolveDisposalStarted(); if (disposalGate !== undefined) await disposalGate; finalRendererState = state; finalRendererSnapshot = snapshot; providerStatus = ""; },
});
attachChannelActivityPresentation(adapter, { destination: () => ({}), renderers: buildSlackActivityRenderers({ botToken: undefined, renderers: [renderer] }) });
mock.module(native("context/serialize"), () => ({ deserializeContext: async () => {
  const ctx = new ContextContainer(); ctx.set(BundleKey, { turnAgent: { id: "fixture" } }); ctx.set(ChannelKey, adapter); return ctx;
} }));
const { activityCollectorWorkflow } = await import(native("execution/activity-collector"));
const { handleActivityRequest } = await import(native("execution/activity-route"));
const { emitTerminalSessionEvent, retireSessionActivityStep } = await import(native("execution/terminal-session-event"));
const { finalizeSession } = await import(native("execution/session/finalization"));
mock.module(native("execution/session/turn"), () => ({ SessionExecution: class { async runTurn() { return { kind: "done", output: "done" }; } } }));
mock.module(native("execution/session/next-input"), () => ({ nextTurnDelivery: async () => { throw Error("Unexpected next input"); } }));
mock.module(native("execution/session-inbox/inbox"), () => ({}));
mock.module(native("execution/cancel-descendant-turns-step"), () => ({ cancelDescendantTurnsStep: async () => {} }));
mock.module(native("execution/session/state-cursor"), () => ({ SessionStateCursor: class { constructor(input) { Object.assign(this, input); } } }));
mock.module(native("execution/session/handoff"), () => ({ SessionHandoff: class { async disposeAnchor() {} }, sessionAnchorToken: (id) => id }));
mock.module(native("execution/session/handoff-steps"), () => ({ signalSessionAnchorStep: async () => {} }));
mock.module(native("execution/session/timeout-control"), () => ({ createSessionTimeoutControl: () => { throw Error("Unexpected timeout"); } }));
mock.module(native("execution/settle-cancelled-turn-step"), () => ({ settleCancelledTurnStep: async () => {} }));
const { runPreparedSession } = await import(native("execution/session/program"));
const { createSessionCompletedEvent, createSessionFailedEvent } = await import(native("protocol/message"));
const sink = { version: 1, url: "http://localhost/activity/" + token };
const serializedContext = { "eve.sessionId": "root-session", [ActivityObserverKey.name]: { sink } };
const streamEvents = [];
const sessionWritable = new WritableStream({ write: (data) => streamEvents.push(new TextDecoder().decode(data)) });
globalThis.fetch = async (url, init) => handleActivityRequest(new Request(url, init), { params: { token } });
const collector = activityCollectorWorkflow({ expiresAt: "2099-01-01T00:00:00Z", serializedContext, token });
function work(id) {
  return { eventId: id + ":started", kind: "work.started", startedAt: "2026-10-13T12:04:00Z", work: { id, kind: "root-turn", rootSessionId: "root-session", rootTurnId: id } };
}
async function send(events) { return globalThis.fetch(sink.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: 1, events }) }); }
async function renderInitial() {
  assert.equal((await send([work("initial")])).status, 202);
  await debounceStarted; timers.shift()(); await renderedOnce;
}
async function retireRoot(type = "session.completed") {
  const event = type === "session.completed" ? createSessionCompletedEvent() : createSessionFailedEvent({ code: "FIXTURE", message: "fixture" });
  await emitTerminalSessionEvent({ serializedContext, sessionWritable, event }); await collector;
}
${scenario}
console.log("native-retirement-complete");
`,
  ]);
  if (expectRenderFailureLogs) {
    expect(result.stderr.toString()).toContain("activity renderer failed");
  } else {
    expect(result.stderr.toString()).toBe("");
  }
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toBe("native-retirement-complete\n");
}

describe("Eve native overlapping task activity", () => {
  test("settles every originating root after the coalesced cohort response", () => {
    runNativeActivity(`
complete("task-0"); complete("task-1");
const { selection, taskContext } = await report();
assert.equal(selection.delivery.payloads.length, 2);
assert.equal(taskContext.rootTurnId, "turn_0");
assert.deepEqual(taskContext.rootTurnIds, ["turn_0", "turn_1"]);
assert.deepEqual(taskContext.settledRootTurnIds, ["turn_0", "turn_1"]);
assert.equal(phase("turn_0"), "completed"); assert.equal(phase("turn_1"), "completed");
assert.equal(selectSlackActivityStatus(snapshot), "");
const revision = snapshot.revision;
await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.completed", "turn_2") });
assert.equal(snapshot.revision, revision);
`);
  });

  test("does not settle an unrelated running foreground root", () => {
    runNativeActivity(`
startRoot("turn_7");
complete("task-0"); complete("task-1"); await report();
assert.equal(phase("turn_0"), "completed"); assert.equal(phase("turn_1"), "completed");
assert.equal(phase("turn_7"), "running");
assert.equal(selectSlackActivityStatus(snapshot), "On it…");
`);
  });

  test("rotates casual loading messages without replacing specific waiting states", () => {
    runNativeActivity(`
startRoot("turn_7");
complete("task-0"); complete("task-1"); await report();
const { buildSlackActivityRenderers, experimental_slackActivityStatus } = await import(native("public/channels/slack/activity"));
const requests = [];
globalThis.fetch = async (_url, init) => {
  requests.push(Object.fromEntries(new URLSearchParams(String(init.body))));
  return Response.json({ ok: true });
};
const [renderer] = buildSlackActivityRenderers({ botToken: "fixture-token", renderers: [experimental_slackActivityStatus()] });
const destination = { channelId: "C-room", threadTs: "1.0", installationTeamId: "T-install" };
await renderer.render({ destination, snapshot, state: undefined });
assert.deepEqual(JSON.parse(requests[0].loading_messages), ["On it…", "Working…", "Getting it ready…", "Doing overtime…"]);
const blocker = { id: "approval-1", kind: "approval", phase: "blocked", startedAt: "2026-10-13T12:05:00.000Z" };
await renderer.render({ destination, snapshot: { ...snapshot, blockers: { "approval-1": blocker } }, state: undefined });
assert.equal(requests[1].status, "Waiting for approval…");
assert.deepEqual(JSON.parse(requests[1].loading_messages), ["Waiting for approval…"]);
`);
  });

  for (const outcome of ["failed", "cancelled"]) {
    test(`settles every eligible cohort root when its combined response is ${outcome}`, () => {
      runNativeActivity(`
complete("task-0"); complete("task-1");
prepare(queue.takeNext(getSessionTaskCohorts(session.state)).delivery);
await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.${outcome}", "turn_2") });
assert.equal(phase("turn_0"), ${JSON.stringify(outcome)}); assert.equal(phase("turn_1"), ${JSON.stringify(outcome)});
assert.equal(selectSlackActivityStatus(snapshot), "");
`);
    });
  }

  test("settles distinct roots when the observer supplies an explicit root work identity", () => {
    runNativeActivity(`
complete("task-0"); complete("task-1");
prepare(queue.takeNext(getSessionTaskCohorts(session.state)).delivery);
ctx.set(ActivityObserverKey, { sink, workIdentity: root("turn_0") });
await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.completed", "turn_2") });
assert.equal(phase("turn_0"), "completed"); assert.equal(phase("turn_1"), "completed");
assert.equal(selectSlackActivityStatus(snapshot), "");
`);
  });

  test("keeps both roots running while overlapping task work is unfinished", () => {
    runNativeActivity(`
complete("task-0");
assert.equal(queue.takeNext(getSessionTaskCohorts(session.state)), undefined);
const taskContext = prepare({ kind: "deliver", taskDeliveryId: "task-0:ready:completed", payloads: [] });
assert.equal(taskContext.phase, "pending"); assert.deepEqual(taskContext.settledRootTurnIds, []);
await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.completed", "turn_2") });
assert.equal(phase("turn_0"), "running"); assert.equal(phase("turn_1"), "running");
assert.equal(Object.values(snapshot.work).find((work) => work.callId === "task-1").phase, "running");
`);
  });

  test("preserves a root that still owns task work in another cohort", () => {
    runNativeActivity(`
complete("task-0"); complete("task-1");
launch("task-2", "turn_0");
const { taskContext } = await report();
assert.deepEqual(taskContext.settledRootTurnIds, ["turn_1"]);
assert.equal(phase("turn_0"), "running"); assert.equal(phase("turn_1"), "completed");
assert.equal(Object.values(snapshot.work).find((work) => work.callId === "task-2").phase, "running");
assert.notEqual(selectSlackActivityStatus(snapshot), "");
`);
  });

  test("preserves a root and its outstanding approval blocker", () => {
    runNativeActivity(`
const request = { requestId: "approval-1", kind: "tool-approval", action: { callId: "approval-call" }, prompt: "Approve" };
session = appendPendingInputBatch({ session, activityRootTurnId: "turn_1", requests: [request], responseMessages: [] });
reduce(projectSessionActivity({ sessionId: "session-1", rootTurnId: "turn_1", event: event("input.requested", "turn_1", { requests: [request] }) }));
complete("task-0"); complete("task-1");
const { taskContext } = await report();
assert.deepEqual(taskContext.settledRootTurnIds, ["turn_0"]);
assert.equal(phase("turn_0"), "completed"); assert.equal(phase("turn_1"), "running");
assert.equal(Object.values(snapshot.blockers)[0].phase, "blocked");
assert.equal(selectSlackActivityStatus(snapshot), "Waiting for approval…");
`);
  });

  test("preserves a root and its outstanding authorization blocker", () => {
    runNativeActivity(`
ctx.set(ActivityRootTurnIdKey, "turn_1");
session = { ...session, state: contextStorage.run(ctx, () => setPendingAuthorization(session.state, { challenges: [{ name: "connection", attemptId: "attempt-1" }] })) };
reduce(projectSessionActivity({ sessionId: "session-1", rootTurnId: "turn_1", event: event("authorization.required", "turn_1", { name: "connection", attemptId: "attempt-1" }) }));
complete("task-0"); complete("task-1"); await report();
assert.equal(phase("turn_0"), "completed"); assert.equal(phase("turn_1"), "running");
assert.equal(Object.values(snapshot.blockers)[0].phase, "blocked");
assert.equal(selectSlackActivityStatus(snapshot), "Waiting for sign-in…");
`);
  });

  test("clears cohort settlement state when a new foreground delivery arrives", () => {
    runNativeActivity(`
complete("task-0"); complete("task-1");
prepare(queue.takeNext(getSessionTaskCohorts(session.state)).delivery);
startRoot("turn_7");
updateActivityRootForDelivery({ activeTurnId: "turn_7", ctx, delivery: { kind: "deliver", payloads: [{ message: "New request" }] }, sessionState: session.state });
ctx.set(TurnTaskDeliveryKey, "none");
assert.equal(ctx.has(ActivityTaskRootTurnIdsKey), false);
assert.equal(ctx.has(ActivitySettledTaskRootTurnIdsKey), false);
await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.completed", "turn_7") });
assert.equal(phase("turn_7"), "completed");
assert.equal(phase("turn_0"), "running"); assert.equal(phase("turn_1"), "running");
`);
  });

  test("rechecks persisted task work between model steps and preserves newly delegated work", () => {
    runNativeActivity(`
complete("task-0"); complete("task-1");
prepare(queue.takeNext(getSessionTaskCohorts(session.state)).delivery);
launch("task-2", "turn_0");
ctx.set(ActivitySettledTaskRootTurnIdsKey, settledTaskActivityRootTurnIds({ state: session.state, rootTurnIds: ctx.get(ActivityTaskRootTurnIdsKey) }));
await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.completed", "turn_2") });
assert.equal(phase("turn_0"), "running"); assert.equal(phase("turn_1"), "completed");
`);
  });

  test("keeps the current root open for live background work not yet committed to the task index", () => {
    runNativeActivity(`
complete("task-0"); complete("task-1");
prepare(queue.takeNext(getSessionTaskCohorts(session.state)).delivery);
ctx.setVirtualContext(BackgroundToolExecutorKey, { hasPendingTasks: () => true });
await observeSessionActivity({ ctx, sessionId: "session-1", event: event("turn.completed", "turn_2") });
assert.equal(phase("turn_0"), "running"); assert.equal(phase("turn_1"), "completed");
`);
  });
});

describe("Eve native activity retirement", () => {
  test("a root that retires before emitting any work still closes its collector", () => {
    runNativeRetirement(`
await retireRoot();
assert.equal(closed, true); assert.equal(disposed, 1); assert.equal(rendered, 0);
assert.equal(finalRendererState, undefined);
assert.equal(finalRendererSnapshot.version, 1);
assert.deepEqual(finalRendererSnapshot.work, {});
assert.equal((await send([work("late-start")])).status, 404);
`);
  });
  for (const terminalType of ["session.completed", "session.failed"]) {
    test(`${terminalType} closes the collector and disposes native renderer state`, () => {
      runNativeRetirement(`
await renderInitial();
await retireRoot(${JSON.stringify(terminalType)});
assert.equal(closed, true); assert.equal(disposed, 1); assert.equal(rendered, 1);
assert.deepEqual(finalRendererState, { card: "working", status: "Working…" });
assert.equal(finalRendererSnapshot.work.initial.rootSessionId, "root-session");
assert.equal(streamEvents.some((entry) => entry.includes(${JSON.stringify(terminalType)})), true);
assert.equal((await send([work("too-late")])).status, 404);
assert.equal(rendered, 1);
`);
    });
  }

  test("retirement during debounce discards queued late activity instead of resurrecting a card", () => {
    runNativeRetirement(`
await renderInitial();
debounceStarted = debounce();
assert.equal((await send([work("queued-late")])).status, 202);
await debounceStarted;
await retireRoot();
assert.equal(closed, true); assert.equal(disposed, 1); assert.equal(rendered, 1);
assert.equal((await send([work("after-retirement")])).status, 404);
`);
  });

  test("the final snapshot reaches custom Slack disposal even when both rendering attempts fail after posting", () => {
    runNativeRetirement(
      `
renderFailures = 2;
await renderInitial(); await retireRoot();
assert.equal(rendered, 2); assert.equal(disposed, 1); assert.equal(closed, true);
assert.equal(finalRendererState, undefined);
assert.equal(finalRendererSnapshot.work.initial.rootSessionId, "root-session");
assert.equal(finalRendererSnapshot.work.initial.rootTurnId, "initial");
assert.equal((await send([work("late")])).status, 404);
`,
      true
    );
  });

  test("a terminal batch discards activity queued before and after its retirement event", () => {
    runNativeRetirement(`
assert.equal((await send([work("before"), { eventId: "root:retired", kind: "session.retired", sessionId: "root-session" }, work("after")])).status, 202);
await collector;
assert.equal(closed, true); assert.equal(disposed, 1); assert.equal(rendered, 0);
assert.equal((await send([work("late")])).status, 404);
`);
  });

  test("done-session finalization retires a collector even when its terminal stream event was emitted in-turn", () => {
    runNativeRetirement(`
await renderInitial();
await finalizeSession({ kind: "done", action: { kind: "done", output: "done" } }, { cursor: { serializedContext, sessionState: undefined }, caller: undefined, mode: "conversation", sessionWritable });
await collector;
assert.equal(closed, true); assert.equal(disposed, 1);
assert.equal((await send([work("late")])).status, 404);
`);
  });

  test("reset/expired finalization emits the terminal event and retires the collector", () => {
    runNativeRetirement(`
await renderInitial();
await finalizeSession({ kind: "expired" }, { cursor: { serializedContext, sessionState: undefined }, caller: undefined, mode: "conversation", sessionWritable });
await collector;
assert.equal(closed, true); assert.equal(disposed, 1);
assert.equal(streamEvents.some((entry) => entry.includes("session.completed")), true);
assert.equal((await send([work("late")])).status, 404);
`);
  });

  for (const lineage of ["parent", "task"]) {
    test(`a child completion identified by ${lineage} lineage never closes the parent collector`, () => {
      runNativeRetirement(`
await renderInitial();
const childContext = { ...serializedContext, "eve.sessionId": "child-session" };
${lineage === "parent" ? 'childContext[ParentSessionKey.name] = { rootSessionId: "root-session" };' : 'childContext[ActivityObserverKey.name] = { sink, workIdentity: { id: "task", kind: "task", rootSessionId: "root-session", rootTurnId: "initial" } };'}
await emitTerminalSessionEvent({ serializedContext: childContext, sessionWritable, event: createSessionCompletedEvent() });
assert.equal(closed, false); assert.equal(disposed, 0);
await retireRoot(); assert.equal(disposed, 1);
`);
    });
  }

  test("a retirement event for a different root session is ignored", () => {
    runNativeRetirement(`
await renderInitial();
const unrelated = send([{ eventId: "other:retired", kind: "session.retired", sessionId: "other-root" }]);
assert.equal(closed, false);
await retireRoot();
assert.equal((await unrelated).status, 202);
assert.equal(disposed, 1); assert.equal(rendered, 1);
`);
  });

  test("retirement is acknowledged only after delayed cleanup and cannot clear replacement status afterward", () => {
    runNativeRetirement(`
await renderInitial();
let releaseDisposal, acknowledged = false;
disposalGate = new Promise((resolve) => { releaseDisposal = resolve; });
const retirement = emitTerminalSessionEvent({ serializedContext, sessionWritable, event: createSessionCompletedEvent() }).then(() => { acknowledged = true; });
await disposalStarted;
assert.equal(acknowledged, false); assert.equal(closed, false); assert.equal(providerStatus, "Working…");
assert.equal((await send([work("queued-during-cleanup")])).status, 202);
assert.equal(rendered, 1);
releaseDisposal(); await retirement; await collector;
assert.equal(acknowledged, true); assert.equal(closed, true); assert.equal(providerStatus, "");
providerStatus = "Replacement session working";
assert.equal((await send([work("after-cleanup")])).status, 404);
assert.equal(providerStatus, "Replacement session working"); assert.equal(disposed, 1);
`);
  });

  test("the session owner keeps continuation aliases until acknowledged renderer cleanup finishes", () => {
    runNativeRetirement(`
await renderInitial();
let releaseDisposal, aliasesReleased = false, finalized = false;
disposalGate = new Promise((resolve) => { releaseDisposal = resolve; });
const owner = runPreparedSession({ anchor: { kind: "self" }, mode: "conversation", serializedContext, sessionState: undefined, sessionId: "root-session", sessionWritable }, { dispose: async () => { aliasesReleased = true; } }).then(() => { finalized = true; });
await disposalStarted;
assert.equal(aliasesReleased, false); assert.equal(finalized, false); assert.equal(closed, false);
releaseDisposal(); await owner; await collector;
assert.equal(aliasesReleased, true); assert.equal(finalized, true); assert.equal(closed, true);
assert.equal(disposed, 1);
`);
  });

  test("retirement transport failures propagate so the workflow step can retry", () => {
    runNativeRetirement(`
await renderInitial();
const deliver = globalThis.fetch;
globalThis.fetch = async () => new Response(null, { status: 503 });
await assert.rejects(() => retireSessionActivityStep({ serializedContext }), /503/);
assert.equal(closed, false); assert.equal(disposed, 0);
globalThis.fetch = deliver; await retireRoot();
`);
  });
});
