"use client";

import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useWorkflowRun } from "../hooks/use-workflow-run";
import { formatDuration, isDeterministic, scheduleRun } from "../lib/workflow";
import type {
  WorkflowNodeData,
  WorkflowTemplate,
  WorkflowTemplateCardProps,
  WorkflowTemplateDialogProps,
  WorkflowTemplatePreviewProps,
} from "../types/workflow";
import { WorkflowBlockIcon } from "./workflow-block-icon";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowRunButton } from "./workflow-run-button";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "./workflow-shell";
import { WorkflowTimer } from "./workflow-timer";

const uniqueIcons = (nodes: WorkflowNodeData[]) => {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    const key = node.logo ?? node.model ?? node.kind;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const aiSteps = (template: WorkflowTemplate) =>
  template.nodes.filter((node) => !isDeterministic(node)).length;

export const WorkflowTemplateCard = ({
  className,
  onUse,
  template,
  ...props
}: WorkflowTemplateCardProps) => (
  <WorkflowShell
    className={className}
    data-slot="workflow-template-card"
    {...props}
  >
    {(template.nodes.length > 0 || template.category) && (
      <WorkflowShellHeader className="flex-nowrap">
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {uniqueIcons(template.nodes)
            .slice(0, 6)
            .map((node) => (
              <WorkflowBlockIcon
                block={node}
                className="size-6 shrink-0"
                key={node.id}
              />
            ))}
        </div>
        {template.category && (
          <Badge className="max-w-32 shrink-0" variant="outline">
            <span className="truncate">{template.category}</span>
          </Badge>
        )}
      </WorkflowShellHeader>
    )}
    <WorkflowShellCard className="flex flex-1 flex-col gap-1 px-4 py-3">
      <h3 className="line-clamp-2 text-sm font-medium break-words">
        {template.title}
      </h3>
      <p className="text-muted-foreground line-clamp-3 text-xs leading-5 break-words">
        {template.description}
      </p>
    </WorkflowShellCard>
    <div className="text-muted-foreground flex min-h-10 items-center gap-3 px-3 text-xs tabular-nums">
      <span>{template.nodes.length} steps</span>
      <span>{aiSteps(template)} AI</span>
      <span>
        ~{formatDuration(scheduleRun(template.nodes, template.edges).totalMs)}
      </span>
      <Button
        className="ml-auto"
        onClick={() => onUse?.(template)}
        size="xs"
        variant="outline"
      >
        Use template
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </div>
  </WorkflowShell>
);

const TemplatePreview = ({ template }: WorkflowTemplatePreviewProps) => {
  const run = useWorkflowRun(template.nodes, template.edges);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <WorkflowRunButton
          disabled={template.nodes.length === 0}
          onPlay={run.play}
          onStop={run.stop}
          phase={run.phase}
          progress={run.elapsedMs / run.totalMs}
        />
        <WorkflowTimer ms={run.elapsedMs} running={run.phase === "running"} />
      </div>
      <WorkflowCanvas
        className="h-80"
        edgeState={run.edgeState}
        edges={template.edges}
        nodeState={run.nodeState}
        nodes={template.nodes}
      />
    </div>
  );
};

export const WorkflowTemplateDialog = ({
  onUse,
  template,
  ...props
}: WorkflowTemplateDialogProps) => (
  <Dialog {...props}>
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-4xl"
      data-slot="workflow-template-dialog"
    >
      {template && (
        <>
          <DialogHeader>
            <DialogTitle className="pr-8 break-words">
              {template.title}
            </DialogTitle>
            <DialogDescription>{template.description}</DialogDescription>
          </DialogHeader>
          <TemplatePreview template={template} />
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-muted-foreground text-xs">
              {template.nodes.length} steps, {aiSteps(template)} with a model
            </span>
            <Button onClick={() => onUse?.(template)}>Use template</Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  </Dialog>
);
