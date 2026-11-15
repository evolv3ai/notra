"use client";

import type { NodeProps } from "@xyflow/react";
import { cn } from "cn";
import { DicesIcon, TimerIcon, TriangleAlertIcon } from "lucide-react";

import {
  WORKFLOW_DEFAULT_DURATION_MS,
  WORKFLOW_KINDS,
  WORKFLOW_NODE_RING,
} from "../constants/workflow";
import {
  WORKFLOW_BANNERS,
  WORKFLOW_BRANCH_LED_CLASS,
  WORKFLOW_BRANCH_RAIL_CLASS,
  WORKFLOW_BRANCH_ROW_CLASS,
  WORKFLOW_CHIP_CLASS,
  WORKFLOW_PORT_ROW_CLASS,
  WORKFLOW_RULE_TOKEN_CLASS,
  WORKFLOW_SKIPPED_DIM_CLASS,
} from "../constants/workflow-ui";
import {
  findModel,
  formatDuration,
  formatRate,
  getInputPorts,
  getOutputPorts,
  isDeterministic,
} from "../lib/workflow";
import type {
  WorkflowFlowNode as WorkflowFlowNodeType,
  WorkflowNodeBannerProps,
  WorkflowNodeBranchProps,
  WorkflowNodeCardProps,
  WorkflowNodeEngineProps,
  WorkflowNodeFooterProps,
  WorkflowNodeSummaryProps,
} from "../types/workflow";
import { WorkflowBlockIcon } from "./workflow-block-icon";
import { WorkflowHandle } from "./workflow-handle";
import { WorkflowLogo, WORKFLOW_LOGOS } from "./workflow-logo";
import { WorkflowShell, WorkflowShellCard } from "./workflow-shell";
import { WorkflowStatusPill } from "./workflow-status";
import { WorkflowTimer } from "./workflow-timer";

const WorkflowNodeBranch = ({
  connectable,
  node,
  port,
  status,
}: WorkflowNodeBranchProps) => {
  const isFinished = status === "success" || status === "error";
  const passed =
    status === "success" &&
    (node.branch === undefined || node.branch === port.id);
  const muted =
    isFinished && node.branch !== undefined && node.branch !== port.id;
  return (
    <div
      className={WORKFLOW_BRANCH_ROW_CLASS}
      data-slot="workflow-node-output"
      data-taken={passed || undefined}
    >
      <span
        className={cn(
          WORKFLOW_BRANCH_LED_CLASS,
          passed
            ? "bg-emerald-500 shadow-[0_0_8px_var(--color-emerald-500)] ring-emerald-500/20"
            : "bg-muted-foreground/35 ring-muted-foreground/10",
          muted && "opacity-40"
        )}
      />
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          WORKFLOW_SKIPPED_DIM_CLASS,
          muted && "opacity-45"
        )}
      >
        <span
          className="truncate text-xs leading-4 font-medium"
          title={port.label ?? port.id}
        >
          {port.label ?? port.id}
        </span>
        {port.hint && (
          <span
            className="text-muted-foreground truncate text-[0.625rem] leading-3.5"
            title={port.hint}
          >
            {port.hint}
          </span>
        )}
      </span>
      {port.rate !== undefined && (
        <span
          className={cn(
            "text-muted-foreground shrink-0 font-mono text-[0.625rem] tabular-nums",
            muted && "opacity-45"
          )}
        >
          {formatRate(port.rate)}
        </span>
      )}
      <WorkflowHandle
        active={passed}
        connectable={connectable}
        portId={port.id}
        type="source"
      />
    </div>
  );
};

const WorkflowNodeBanner = ({ status }: WorkflowNodeBannerProps) => {
  if (status !== "error" && status !== "waiting") {
    return null;
  }
  const banner = WORKFLOW_BANNERS[status];
  return (
    <div
      className={cn(
        "flex h-7 min-w-0 items-center gap-1.5 px-2.5 text-[0.6875rem] font-medium",
        banner.className
      )}
      data-slot="workflow-node-banner"
    >
      <TriangleAlertIcon className="size-3.5 shrink-0" />
      <span className="shrink-0">{banner.label}</span>
      <span className="text-muted-foreground truncate font-normal">
        {banner.message}
      </span>
    </div>
  );
};

const WorkflowNodeSummary = ({ children, node }: WorkflowNodeSummaryProps) => {
  const body = children ?? node.description;
  return (
    <>
      {node.rule && (
        <div
          className={cn(
            "text-muted-foreground border-table-card-border flex min-w-0 flex-wrap items-center gap-1 border-t px-3 py-2 text-[0.6875rem]",
            WORKFLOW_SKIPPED_DIM_CLASS
          )}
          data-slot="workflow-node-rule"
        >
          <span className={WORKFLOW_RULE_TOKEN_CLASS}>{node.rule.subject}</span>
          <span className="shrink-0">{node.rule.operator}</span>
          <span
            className={cn(
              WORKFLOW_RULE_TOKEN_CLASS,
              "bg-primary/10 text-primary font-medium"
            )}
          >
            {node.rule.value}
          </span>
        </div>
      )}
      {body && !node.rule && (
        <div className="text-muted-foreground border-table-card-border border-t px-3 py-2 text-xs leading-[1.125rem]">
          <div
            className={cn(
              "line-clamp-2 break-words",
              WORKFLOW_SKIPPED_DIM_CLASS
            )}
          >
            {body}
          </div>
        </div>
      )}
    </>
  );
};

const WorkflowNodeEngine = ({ node }: WorkflowNodeEngineProps) => {
  const model = findModel(node.model);
  const deterministic = isDeterministic(node);
  return (
    <>
      {model && (
        <span className={WORKFLOW_CHIP_CLASS} title={model.label}>
          <WorkflowLogo name={model.logo} />
          <span className="truncate">{model.label}</span>
          {!deterministic && (
            <DicesIcon
              aria-label="Non-deterministic"
              className="text-violet-500"
            />
          )}
        </span>
      )}
      {!model && !deterministic && (
        <span
          className={cn(
            WORKFLOW_CHIP_CLASS,
            "text-violet-600 dark:text-violet-300"
          )}
          title={node.model ?? "Non-deterministic"}
        >
          <DicesIcon />
          <span className="truncate">{node.model ?? "AI"}</span>
        </span>
      )}
      {!model && deterministic && node.model && (
        <span className={WORKFLOW_CHIP_CLASS} title={node.model}>
          <span className="truncate">{node.model}</span>
        </span>
      )}
      {node.logo && (deterministic || !(model || node.model)) && (
        <span className={WORKFLOW_CHIP_CLASS}>
          <WorkflowLogo name={node.logo} />
          <span className="truncate">{WORKFLOW_LOGOS[node.logo].label}</span>
        </span>
      )}
    </>
  );
};

const WorkflowNodeTimer = ({ node, state }: WorkflowNodeFooterProps) => {
  const status = state?.status ?? "idle";
  const isLive = status === "running" || status === "waiting";
  const isFinished = status === "success" || status === "error";
  return (
    <span className={cn(WORKFLOW_CHIP_CLASS, "ml-auto shrink-0")}>
      <TimerIcon />
      {(isLive || isFinished) && state ? (
        <WorkflowTimer
          className="text-[0.6875rem]"
          ms={state.elapsedMs}
          running={isLive}
        />
      ) : (
        <span className="font-mono">
          ~{formatDuration(node.durationMs ?? WORKFLOW_DEFAULT_DURATION_MS)}
        </span>
      )}
    </span>
  );
};

const WorkflowNodeFooter = ({ node, state }: WorkflowNodeFooterProps) => (
  <div
    className={cn(
      "flex h-8 min-w-0 items-center gap-1 px-1.5",
      WORKFLOW_SKIPPED_DIM_CLASS
    )}
    data-slot="workflow-node-footer"
  >
    <WorkflowNodeEngine node={node} />
    <WorkflowNodeTimer node={node} state={state} />
  </div>
);

export const WorkflowNodeCard = ({
  children,
  className,
  connectable,
  node,
  selected,
  state,
  ...props
}: WorkflowNodeCardProps) => {
  const kind = WORKFLOW_KINDS[node.kind];
  const status = state?.status ?? "idle";
  const inputs = getInputPorts(node);
  const outputs = getOutputPorts(node);
  const [singleInput] = inputs.length === 1 && !inputs[0]?.label ? inputs : [];
  const [singleOutput] =
    outputs.length === 1 && !outputs[0]?.label ? outputs : [];
  const labeledInputs = singleInput ? [] : inputs;
  const labeledOutputs = singleOutput ? [] : outputs;
  const isLive = status === "running" || status === "waiting";
  const isFinished = status === "success" || status === "error";

  return (
    <WorkflowShell
      className={cn(
        "group/node w-64 transition-[border-color,box-shadow] duration-300",
        WORKFLOW_NODE_RING[status],
        selected &&
          "border-primary shadow-[0_0_0_0.25rem_color-mix(in_oklab,var(--color-primary,var(--primary))_18%,transparent)]",
        className
      )}
      data-kind={node.kind}
      data-slot="workflow-node-card"
      data-status={status}
      {...props}
    >
      <WorkflowNodeBanner status={status} />
      <WorkflowShellCard>
        <div className="relative flex items-center gap-2.5 px-3 py-2.5">
          {singleInput && (
            <WorkflowHandle
              active={isLive || isFinished}
              connectable={connectable}
              portId={singleInput.id}
              type="target"
            />
          )}
          <WorkflowBlockIcon
            block={{ kind: node.kind, logo: node.logo, model: node.model }}
            className={cn("size-9 rounded-[10px]", WORKFLOW_SKIPPED_DIM_CLASS)}
          />
          <span
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              WORKFLOW_SKIPPED_DIM_CLASS
            )}
          >
            <span className="line-clamp-2 text-[0.8125rem] leading-5 font-medium break-words">
              {node.title}
            </span>
            <span className="text-muted-foreground truncate text-[0.6875rem] leading-4">
              {kind.label}
            </span>
          </span>
          <WorkflowStatusPill
            className={WORKFLOW_SKIPPED_DIM_CLASS}
            status={status}
          />
          {singleOutput && (
            <WorkflowHandle
              active={status === "success"}
              connectable={connectable}
              portId={singleOutput.id}
              type="source"
            />
          )}
        </div>
        <WorkflowNodeSummary node={node}>{children}</WorkflowNodeSummary>
        {labeledInputs.map((port) => (
          <div
            className={WORKFLOW_PORT_ROW_CLASS}
            data-slot="workflow-node-input"
            key={port.id}
          >
            <WorkflowHandle
              active={isLive || isFinished}
              connectable={connectable}
              portId={port.id}
              type="target"
            />
            <span
              className={cn("min-w-0 truncate", WORKFLOW_SKIPPED_DIM_CLASS)}
              title={port.label ?? port.id}
            >
              {port.label ?? port.id}
            </span>
          </div>
        ))}
      </WorkflowShellCard>
      {labeledOutputs.length > 0 && (
        <div
          className={WORKFLOW_BRANCH_RAIL_CLASS}
          data-slot="workflow-node-branches"
        >
          {labeledOutputs.map((port) => (
            <WorkflowNodeBranch
              connectable={connectable}
              key={port.id}
              node={node}
              port={port}
              status={status}
            />
          ))}
        </div>
      )}
      <WorkflowNodeFooter node={node} state={state} />
    </WorkflowShell>
  );
};

export const WorkflowFlowNode = ({
  data,
  selected,
}: NodeProps<WorkflowFlowNodeType>) => (
  <WorkflowNodeCard
    connectable
    node={data.node}
    selected={selected}
    state={data.state}
  />
);
