"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../select/components/select";
import { WORKFLOW_KINDS } from "../constants/workflow";
import { WORKFLOW_SECTION_TITLE_CLASS } from "../constants/workflow-ui";
import {
  getInputPorts,
  getOutputPorts,
  isDeterministic,
} from "../lib/workflow";
import type {
  WorkflowBranchSelectProps,
  WorkflowNodeSettingsProps,
  WorkflowNodeSheetProps,
  WorkflowPortListProps,
} from "../types/workflow";
import { WorkflowBlockIcon } from "./workflow-block-icon";
import { WorkflowModelSelect } from "./workflow-model-select";
import { WorkflowRunLog } from "./workflow-run-log";
import {
  WorkflowDeterminismBadge,
  WorkflowStatusBadge,
} from "./workflow-status";
import { WorkflowTimer } from "./workflow-timer";

const PortList = ({ ports, title }: WorkflowPortListProps) =>
  ports.some((port) => port.label) ? (
    <div className="flex flex-col gap-1.5">
      <h3 className={WORKFLOW_SECTION_TITLE_CLASS}>{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {ports.map((port) => (
          <span
            className="bg-muted max-w-full truncate rounded-md px-2 py-0.5 font-mono text-[0.6875rem]"
            key={port.id}
          >
            {port.label ?? port.id}
          </span>
        ))}
      </div>
    </div>
  ) : null;

const WorkflowBranchSelect = ({
  node,
  onBranchChange,
  outputs,
}: WorkflowBranchSelectProps) =>
  outputs.length > 1 ? (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm leading-none font-medium"
        htmlFor={`${node.id}-branch`}
      >
        Path to follow
      </label>
      <Select
        onValueChange={(branch) => {
          if (typeof branch === "string") {
            onBranchChange(node.id, branch);
          }
        }}
        value={node.branch ?? outputs[0]?.id}
      >
        <SelectTrigger className="w-full" id={`${node.id}-branch`}>
          <SelectValue>
            {(value: string | null) =>
              outputs.find((port) => port.id === value)?.label ?? value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {outputs.map((port) => (
            <SelectItem key={port.id} value={port.id}>
              {port.label ?? port.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        The preview run follows this path and skips the others.
      </p>
    </div>
  ) : null;

const WorkflowNodeSettings = ({
  node,
  onBranchChange,
  onModelChange,
}: WorkflowNodeSettingsProps) => {
  const outputs = getOutputPorts(node);
  return (
    <>
      {node.description && (
        <p className="text-muted-foreground text-sm">{node.description}</p>
      )}
      {node.kind === "ai" && onModelChange && (
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm leading-none font-medium"
            htmlFor={`${node.id}-model`}
          >
            Model
          </label>
          <WorkflowModelSelect
            id={`${node.id}-model`}
            onValueChange={(model) => onModelChange(node.id, model)}
            value={node.model}
          />
          <p className="text-muted-foreground text-xs">
            The same input can give a different answer on each run. Keep the
            temperature low for classification.
          </p>
        </div>
      )}
      {onBranchChange && (
        <WorkflowBranchSelect
          node={node}
          onBranchChange={onBranchChange}
          outputs={outputs}
        />
      )}
      {node.fields && node.fields.length > 0 && (
        <dl className="border-table-card-border bg-table-card divide-table-row-border divide-y rounded-xl border text-[0.8125rem]">
          {node.fields.map((field) => (
            <div
              className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3"
              key={field.label}
            >
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="font-mono text-xs leading-5 break-words">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <PortList ports={getInputPorts(node)} title="Inputs" />
      <PortList ports={outputs} title="Outputs" />
    </>
  );
};

export const WorkflowNodeSheet = ({
  log = [],
  node,
  onBranchChange,
  onDelete,
  onModelChange,
  state,
  ...props
}: WorkflowNodeSheetProps) => {
  const status = state?.status ?? "idle";
  const nodeLog = node ? log.filter((entry) => entry.nodeId === node.id) : [];

  return (
    <Sheet {...props}>
      <SheetContent
        className="gap-0 sm:max-w-md"
        data-slot="workflow-node-sheet"
      >
        {node && (
          <>
            <SheetHeader className="border-foreground/10 gap-3 border-b p-4">
              <div className="flex items-center gap-3 pr-8">
                <WorkflowBlockIcon
                  block={node}
                  className="size-9 rounded-lg [&_svg]:size-4.5"
                />
                <div className="flex min-w-0 flex-col">
                  <SheetTitle className="truncate">{node.title}</SheetTitle>
                  <SheetDescription className="text-xs">
                    {WORKFLOW_KINDS[node.kind].label}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <WorkflowStatusBadge status={status} />
                <WorkflowDeterminismBadge
                  deterministic={isDeterministic(node)}
                />
                {state && state.elapsedMs > 0 && (
                  <WorkflowTimer
                    className="ml-auto"
                    ms={state.elapsedMs}
                    running={status === "running" || status === "waiting"}
                  />
                )}
              </div>
            </SheetHeader>
            <Tabs className="min-h-0 flex-1 gap-0" defaultValue="settings">
              <TabsList className="mx-4 mt-3 w-[calc(100%-2rem)]">
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="run">Run</TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
              </TabsList>
              <TabsContent
                className="flex flex-col gap-5 overflow-y-auto p-4"
                value="settings"
              >
                <WorkflowNodeSettings
                  node={node}
                  onBranchChange={onBranchChange}
                  onModelChange={onModelChange}
                />
              </TabsContent>
              <TabsContent className="overflow-y-auto py-3" value="run">
                <WorkflowRunLog
                  emptyLabel="This step hasn't run yet."
                  entries={nodeLog}
                />
              </TabsContent>
              <TabsContent className="overflow-y-auto p-4" value="output">
                {node.output && status === "success" ? (
                  <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs leading-5">
                    {node.output}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {node.output
                      ? "The output shows up when this step completes."
                      : "This step has no output to show."}
                  </p>
                )}
              </TabsContent>
            </Tabs>
            {onDelete && (
              <SheetFooter className="border-foreground/10 border-t p-3">
                <Button onClick={() => onDelete(node.id)} variant="outline">
                  <Trash2Icon data-icon="inline-start" />
                  Delete step
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
