import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
} from "@notra/workflows/types/graph";

import {
  AUTOPILOT_WORKFLOW_COLUMN_WIDTH as COLUMN,
  AUTOPILOT_WORKFLOW_ROW_HEIGHT as ROW,
  AUTOPILOT_WORKFLOW_RUN_REFERENCE as RUN,
} from "@/constants/autopilot-workflow";
import {
  AUTOPILOT_CONTENT_WORKFLOW_KEY,
  AUTOPILOT_DAILY_WORKFLOW_KEY,
  AUTOPILOT_TEMPLATE_WORKFLOW_KEYS,
} from "@/constants/workflow-engine";
import { workflowBlockRegistry } from "@/lib/workflow-engine/blocks";

const at = (column: number, row: number) => ({
  x: column * COLUMN,
  y: row * ROW,
});

const step = (
  id: string,
  type: string,
  position: { x: number; y: number },
  extra: Partial<WorkflowNode> = {}
): WorkflowNode => {
  const block = workflowBlockRegistry.get(type);
  if (!block) {
    throw new Error(`No block "${type}" is registered`);
  }
  return {
    id,
    type,
    title: block.title,
    position,
    ...extra,
    config: { autopilotRunId: RUN, ...extra.config },
  };
};

const edge = (
  source: string,
  target: string,
  sourcePort?: string
): WorkflowEdge => ({
  id: [source, sourcePort, target].filter(Boolean).join("__"),
  source,
  target,
  ...(sourcePort ? { sourcePort } : {}),
});

const out = (node: string, path?: string) =>
  `{{nodes.${node}.output${path ? `.${path}` : ""}}}`;

const INSIGHTS = [
  out("gather", "prompts.insights"),
  out("gather", "competitors.insights"),
];

const DRAFT_CONFIG = {
  proposal: out("plan", "proposal"),
  brief: out("plan", "brief"),
  confidence: out("plan", "confidence"),
};

const contentCall = (observations: string[]): WorkflowNode => ({
  id: "content",
  type: "core.run-workflow",
  title: "Plan and write content",
  position: at(3, 1),
  onError: "continue",
  config: {
    workflow: AUTOPILOT_CONTENT_WORKFLOW_KEY,
    input: { autopilotRunId: RUN, observations },
  },
});

const ACTED = {
  decision: out("content", "decision"),
  acted: out("content", "acted"),
};

const outcomeIs = (value: string) => ({
  id: value,
  rule: { subject: out("plan", "outcome"), operator: "equals", value },
});

const AUTOPILOT_CONTENT_WORKFLOW: WorkflowDefinition = {
  key: AUTOPILOT_CONTENT_WORKFLOW_KEY,
  title: "Plan and write content",
  startedBy: "call",
  graph: {
    nodes: [
      {
        id: "start",
        type: "core.trigger",
        title: "Called by the daily run",
        position: at(0, 1),
      },
      step("plan", "autopilot.plan", at(1, 1), {
        onError: "continue",
        config: { observations: "{{trigger.observations}}" },
      }),
      {
        id: "route",
        type: "core.switch",
        title: "What the plan says",
        position: at(2, 1),
        config: {
          cases: [
            { ...outcomeIs("open"), label: "Write a draft" },
            { ...outcomeIs("suggest"), label: "Save as an idea" },
          ],
        },
      },
      step("write", "autopilot.write-post", at(3, 0), {
        onError: "continue",
        config: DRAFT_CONFIG,
      }),
      step("idea", "autopilot.save-idea", at(3, 2), {
        onError: "continue",
        config: DRAFT_CONFIG,
      }),
    ],
    edges: [
      edge("start", "plan"),
      edge("plan", "route"),
      edge("route", "write", "open"),
      edge("route", "idea", "suggest"),
    ],
    output: {
      decision: out("plan"),
      acted: [out("write", "acted"), out("idea", "acted")],
    },
  },
};

export const AUTOPILOT_DAILY_WORKFLOW: WorkflowDefinition = {
  key: AUTOPILOT_DAILY_WORKFLOW_KEY,
  title: "Autopilot daily",
  startedBy: "schedule",
  graph: {
    nodes: [
      {
        id: "start",
        type: "core.trigger",
        title: "Every day",
        description: "At the workspace's brief hour, or Run now",
        position: at(0, 1),
      },
      step("close-stale", "autopilot.close-stale", at(1, 1), {
        onError: "continue",
      }),
      step("gather", "autopilot.gather", at(2, 1), { onError: "continue" }),
      step("readiness", "autopilot.readiness", at(2, 0), {
        onError: "continue",
      }),
      contentCall([
        out("gather", "keywords.observations"),
        out("gather", "commits.observations"),
      ]),
      step("brief", "autopilot.brief", at(4, 1), {
        config: {
          ...ACTED,
          previousRunAt: "{{trigger.previousRunAt}}",
          insights: INSIGHTS,
        },
      }),
    ],
    edges: [
      edge("start", "close-stale"),
      edge("close-stale", "gather"),
      edge("close-stale", "readiness"),
      edge("gather", "content"),
      edge("readiness", "content"),
      edge("gather", "brief"),
      edge("content", "brief"),
    ],
    onFailure: {
      type: "autopilot.fail-run",
      config: { autopilotRunId: RUN, insights: INSIGHTS },
    },
  },
};

const template = (
  key: string,
  title: string,
  work: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  finish: Record<string, unknown> = {}
): WorkflowDefinition => ({
  key,
  title,
  startedBy: "schedule",
  graph: {
    nodes: [
      {
        id: "start",
        type: "core.trigger",
        title: "Run now",
        description: "Started from the dashboard",
        position: at(1, 1),
      },
      ...work.nodes,
      step("finish", "autopilot.finish", at(4, 1), { config: finish }),
    ],
    edges: [edge("start", "finish"), ...work.edges],
    onFailure: {
      type: "autopilot.fail-run",
      config: { autopilotRunId: RUN, scheduled: false },
    },
  },
});

const contentTemplate = (
  key: string,
  title: string,
  job: "keywords" | "commits"
) =>
  template(
    key,
    title,
    {
      nodes: [
        step("gather", "autopilot.gather", at(2, 1), {
          onError: "continue",
          config: { jobs: [job] },
        }),
        contentCall([out("gather", `${job}.observations`)]),
      ],
      edges: [
        edge("start", "gather"),
        edge("gather", "content"),
        edge("content", "finish"),
      ],
    },
    ACTED
  );

const AUTOPILOT_TEMPLATE_WORKFLOWS: WorkflowDefinition[] = [
  template(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.readiness, "Fix agent readiness", {
    nodes: [
      step("readiness", "autopilot.readiness", at(2, 1), {
        onError: "continue",
      }),
    ],
    edges: [edge("start", "readiness"), edge("readiness", "finish")],
  }),
  contentTemplate(
    AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.keywords,
    "Write for content gaps",
    "keywords"
  ),
  contentTemplate(
    AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.commits,
    "Write about releases",
    "commits"
  ),
];

export const workflowDefinitions: Record<string, WorkflowDefinition> =
  Object.fromEntries(
    [
      AUTOPILOT_DAILY_WORKFLOW,
      AUTOPILOT_CONTENT_WORKFLOW,
      ...AUTOPILOT_TEMPLATE_WORKFLOWS,
    ].map((definition) => [definition.key, definition])
  );
