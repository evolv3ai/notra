import * as z from "zod";

import {
  WORKFLOW_CALL_TYPE,
  WORKFLOW_IF_PORTS,
  WORKFLOW_IF_TYPE,
  WORKFLOW_OTHERWISE_PORT,
  WORKFLOW_SWITCH_TYPE,
  WORKFLOW_TRIGGER_TYPE,
} from "../constants/graph";
import {
  workflowCallConfigSchema,
  workflowIfConfigSchema,
  workflowSwitchConfigSchema,
} from "../schemas/core";
import type { WorkflowBranchCase, WorkflowCoreBlock } from "../types/core";
import type {
  WorkflowNodeKind,
  WorkflowPort,
  WorkflowRule,
} from "../types/graph";
import type { WorkflowScope } from "../types/run";
import { formatConfigIssues } from "../utils/errors";
import { unresolvedReferences } from "../utils/references";
import { evaluateRule } from "./rules";

function missingValues(rule: unknown, scope: WorkflowScope) {
  if (
    typeof rule !== "object" ||
    rule === null ||
    ("operator" in rule && rule.operator === "exists")
  ) {
    return [];
  }
  return unresolvedReferences(
    [
      "subject" in rule ? rule.subject : undefined,
      "value" in rule ? rule.value : undefined,
    ],
    scope
  );
}

function branchBlock<Schema extends z.ZodType>(block: {
  kind: WorkflowNodeKind;
  configSchema: Schema;
  outputs: (config: unknown) => WorkflowPort[] | undefined;
  cases: (config: z.output<Schema>) => WorkflowBranchCase[];
  rawRules: (config: Record<string, unknown>) => unknown[];
  fallback: string;
}): WorkflowCoreBlock {
  return {
    kind: block.kind,
    configSchema: block.configSchema,
    outputs: block.outputs,
    run: async ({ node, config, scope }) => {
      const parsed = block.configSchema.safeParse(config);
      if (!parsed.success) {
        return {
          status: "error",
          error: formatConfigIssues(node.title, parsed.error),
        };
      }
      const raw = block.rawRules(node.config ?? {});
      const missing = new Set<string>();
      const match = block.cases(parsed.data).find((item, index) => {
        const absent = missingValues(raw[index], scope);
        for (const path of absent) {
          missing.add(path);
        }
        return absent.length === 0 && evaluateRule(item.rule);
      });
      const port = match?.id ?? block.fallback;
      return {
        status: "success",
        port,
        output: { port },
        ...(missing.size > 0
          ? { reason: `No value for ${[...missing].join(", ")}` }
          : {}),
      };
    },
  };
}

const workflowCoreBlocks: Record<string, WorkflowCoreBlock> = {
  [WORKFLOW_TRIGGER_TYPE]: {
    kind: "trigger",
    configSchema: z.record(z.string(), z.unknown()),
    outputs: () => undefined,
    run: async ({ scope }) => ({ status: "success", output: scope.trigger }),
  },
  [WORKFLOW_IF_TYPE]: branchBlock({
    kind: "condition",
    configSchema: workflowIfConfigSchema,
    outputs: () => WORKFLOW_IF_PORTS,
    cases: ({ rule }) => [{ id: "true", rule }],
    rawRules: (config) => [config.rule],
    fallback: "false",
  }),
  [WORKFLOW_SWITCH_TYPE]: branchBlock({
    kind: "switch",
    configSchema: workflowSwitchConfigSchema,
    outputs: (config) => {
      const parsed = workflowSwitchConfigSchema.safeParse(config);
      return parsed.success
        ? [
            ...parsed.data.cases.map(({ id, label }) =>
              label ? { id, label } : { id }
            ),
            { id: WORKFLOW_OTHERWISE_PORT, label: "Otherwise" },
          ]
        : undefined;
    },
    cases: ({ cases }) => cases,
    rawRules: (config) =>
      Array.isArray(config.cases)
        ? config.cases.map((item: unknown) =>
            typeof item === "object" && item !== null && "rule" in item
              ? item.rule
              : undefined
          )
        : [],
    fallback: WORKFLOW_OTHERWISE_PORT,
  }),
  [WORKFLOW_CALL_TYPE]: {
    kind: "workflow",
    configSchema: workflowCallConfigSchema,
    outputs: () => undefined,
    run: async ({ node, config, effects }) => {
      const parsed = workflowCallConfigSchema.safeParse(config);
      if (!parsed.success) {
        return {
          status: "error",
          error: formatConfigIssues(node.title, parsed.error),
        };
      }
      return await effects.callWorkflow({
        node,
        workflow: parsed.data.workflow,
        input: parsed.data.input ?? {},
      });
    },
  },
};

export function getWorkflowCoreBlock(type: string) {
  return Object.hasOwn(workflowCoreBlocks, type)
    ? workflowCoreBlocks[type]
    : undefined;
}
