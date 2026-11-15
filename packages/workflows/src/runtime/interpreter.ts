import { WORKFLOW_FAILURE_NODE_ID } from "../constants/graph";
import type {
  CompiledWorkflowGraph as WorkflowGraph,
  CompiledWorkflowNode as WorkflowNode,
} from "../types/graph";
import type {
  WorkflowGraphResult,
  WorkflowInterpreterEffects,
  WorkflowInterpreterInput,
  WorkflowNodeEvent,
  WorkflowNodeSettlement,
} from "../types/interpreter";
import type { WorkflowNodeOutcome, WorkflowScope } from "../types/run";
import { errorMessage } from "../utils/errors";
import { resolveReferences } from "../utils/references";
import { getWorkflowCoreBlock } from "./core-blocks";
import {
  completeNode,
  createRunState,
  isRunSettled,
  markNodeStarted,
  readyNodes,
  settleSkippedNodes,
  toScope,
} from "./scheduler";

const runSafely = async (
  run: () => Promise<WorkflowNodeOutcome>
): Promise<WorkflowNodeOutcome> => {
  try {
    return await run();
  } catch (error) {
    return { status: "error", error: errorMessage(error) };
  }
};

const now = () => new Date().toISOString();

const toEvent = (outcome: WorkflowNodeOutcome): WorkflowNodeSettlement => {
  if (outcome.status === "success") {
    return {
      status: "success",
      port: outcome.port ?? null,
      output: outcome.output,
    };
  }
  if (outcome.status === "halted") {
    return { status: "halted", output: outcome.output, reason: outcome.reason };
  }
  return { status: "error", error: outcome.error };
};

export async function runWorkflowFailureHandler<
  Failure extends { error: string },
>(params: {
  graph: WorkflowGraph;
  trigger: unknown;
  effects: WorkflowInterpreterEffects;
  failure: Failure;
  scope?: WorkflowScope;
}): Promise<Failure> {
  const { graph, trigger, effects, failure } = params;
  if (!graph.onFailure) {
    return failure;
  }
  const { onFailure } = graph;
  const scope = params.scope ?? { trigger, nodes: {} };
  const startedAt = now();
  const outcome = await runSafely(() =>
    effects.runBlock({
      node: {
        id: WORKFLOW_FAILURE_NODE_ID,
        kind: "task",
        type: onFailure.type,
        title: "On failure",
      },
      config: resolveReferences(onFailure.config ?? {}, scope) as Record<
        string,
        unknown
      >,
      failure: { error: failure.error },
    })
  );
  await effects
    .record([
      {
        nodeId: WORKFLOW_FAILURE_NODE_ID,
        ...toEvent(outcome),
        startedAt,
        finishedAt: now(),
      },
    ])
    .catch(() => undefined);
  return outcome.status === "error"
    ? {
        ...failure,
        error: `${failure.error} (the failure handler failed too: ${outcome.error})`,
      }
    : failure;
}

export async function interpretWorkflowGraph(
  params: WorkflowInterpreterInput
): Promise<WorkflowGraphResult> {
  const { graph, trigger, effects } = params;
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const state = createRunState(graph);
  const pending: WorkflowNodeEvent[] = [];
  const inFlight = new Map<
    string,
    Promise<{ nodeId: string; startedAt: string; outcome: WorkflowNodeOutcome }>
  >();

  const flush = async () => {
    if (pending.length > 0) {
      await effects.record(pending.splice(0));
    }
  };

  const run = async (node: WorkflowNode): Promise<WorkflowNodeOutcome> => {
    const scope = toScope(trigger, state);
    const config = resolveReferences(node.config ?? {}, scope) as Record<
      string,
      unknown
    >;
    const core = getWorkflowCoreBlock(node.type);
    return core
      ? await core.run({ node, config, scope, effects })
      : await effects.runBlock({ node, config });
  };

  const launch = async (node: WorkflowNode) => {
    markNodeStarted(state, node.id);
    const startedAt = now();
    return {
      nodeId: node.id,
      startedAt,
      outcome: await runSafely(() => run(node)),
    };
  };

  while (true) {
    for (const { nodeId, reason } of settleSkippedNodes(graph, state)) {
      pending.push({ nodeId, status: "skipped", reason, finishedAt: now() });
    }
    for (const nodeId of readyNodes(graph, state)) {
      const node = nodes.get(nodeId);
      if (node && !inFlight.has(nodeId)) {
        inFlight.set(nodeId, launch(node));
      }
    }
    if (inFlight.size === 0) {
      break;
    }
    try {
      await flush();
    } catch (error) {
      await Promise.allSettled(inFlight.values());
      throw error;
    }
    const { nodeId, startedAt, outcome } = await Promise.race(
      inFlight.values()
    );
    inFlight.delete(nodeId);
    const settled = completeNode(graph, state, nodeId, outcome);
    pending.push({
      nodeId,
      ...settled,
      port: settled.port ?? null,
      startedAt,
      finishedAt: now(),
    });
  }
  await flush();

  if (!isRunSettled(state)) {
    throw new Error("The workflow stopped with steps still pending");
  }
  const scope = toScope(trigger, state);
  if (state.failure) {
    const failure = await runWorkflowFailureHandler({
      graph,
      trigger,
      effects,
      failure: state.failure,
      scope,
    });
    return { state, failure, output: undefined };
  }
  return {
    state,
    failure: null,
    output: graph.output ? resolveReferences(graph.output, scope) : undefined,
  };
}
