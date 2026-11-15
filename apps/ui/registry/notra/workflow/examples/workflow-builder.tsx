"use client";

import { MapIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../select/components/select";
import { WorkflowCanvas } from "../components/workflow-canvas";
import { WorkflowNodePalette } from "../components/workflow-node-palette";
import { WorkflowNodeSheet } from "../components/workflow-node-sheet";
import { WorkflowRunButton } from "../components/workflow-run-button";
import { WorkflowRunLog } from "../components/workflow-run-log";
import { WorkflowRunTimeline } from "../components/workflow-run-timeline";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";
import { WorkflowTimer } from "../components/workflow-timer";
import { WORKFLOW_BLOCKS } from "../constants/workflow-blocks";
import {
  LISTICLE_OUTREACH_WORKFLOW,
  WORKFLOW_TEMPLATES,
} from "../constants/workflow-templates";
import { WORKFLOW_COLUMN } from "../constants/workflow-ui";
import { useWorkflowGraph } from "../hooks/use-workflow-graph";
import { useWorkflowRun } from "../hooks/use-workflow-run";
import {
  createNodeFromBlock,
  formatDuration,
  getRunLog,
  isDeterministic,
} from "../lib/workflow";
import type { WorkflowBlock, WorkflowPoint } from "../types/workflow";

export default function WorkflowBuilder() {
  const [templateId, setTemplateId] = useState(LISTICLE_OUTREACH_WORKFLOW.id);
  const graph = useWorkflowGraph(LISTICLE_OUTREACH_WORKFLOW);
  const run = useWorkflowRun(graph.nodes, graph.edges);
  const [selectedId, setSelectedId] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusId, setFocusId] = useState<string>();
  const [minimap, setMinimap] = useState(false);
  const selected = graph.nodes.find((node) => node.id === selectedId);
  const log = getRunLog(graph.nodes, run.schedule, run.phase, run.elapsedMs);
  const aiSteps = graph.nodes.filter((node) => !isDeterministic(node)).length;

  const loadTemplate = (id: string) => {
    const template = WORKFLOW_TEMPLATES.find((item) => item.id === id);
    if (!template) {
      return;
    }
    run.stop();
    graph.load(template);
    setTemplateId(id);
  };

  const addBlock = (block: WorkflowBlock, position?: WorkflowPoint) => {
    const right = Math.max(0, ...graph.nodes.map((node) => node.position.x));
    const node = createNodeFromBlock(
      block,
      position ?? { x: right + WORKFLOW_COLUMN, y: 24 }
    );
    graph.addNode(node);
    if (!position) {
      setFocusId(node.id);
    }
  };

  const openNode = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  return (
    <WorkflowShell className="h-[46rem] w-full">
      <WorkflowShellHeader className="gap-3 px-1.5">
        <Select
          onValueChange={(value) => {
            if (typeof value === "string") {
              loadTemplate(value);
            }
          }}
          value={templateId}
        >
          <SelectTrigger aria-label="Workflow" className="w-56" size="sm">
            <SelectValue>
              {(value: string | null) =>
                WORKFLOW_TEMPLATES.find((item) => item.id === value)?.title
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_TEMPLATES.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {graph.nodes.length} steps · {aiSteps} AI · ~
          {formatDuration(run.totalMs)}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <WorkflowTimer
            className="text-xs"
            ms={run.elapsedMs}
            running={run.phase === "running"}
          />
          <WorkflowRunButton
            disabled={graph.nodes.length === 0}
            onPlay={run.play}
            onStop={run.stop}
            phase={run.phase}
            progress={run.elapsedMs / run.totalMs}
          />
        </div>
      </WorkflowShellHeader>
      <WorkflowShellCard className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[15rem_minmax(0,1fr)]">
        <WorkflowNodePalette
          blocks={WORKFLOW_BLOCKS}
          className="border-table-card-border hidden border-r md:flex"
          onAdd={(block) => addBlock(block)}
        />
        <div className="flex min-h-0 min-w-0 flex-col">
          <WorkflowCanvas
            className="flex-1 rounded-none border-0"
            edgeState={run.edgeState}
            edges={graph.edges}
            focusId={focusId}
            key={templateId}
            minimap={minimap}
            nodeState={run.nodeState}
            nodes={graph.nodes}
            onConnect={graph.connect}
            onDropBlock={(blockId, position) => {
              const block = WORKFLOW_BLOCKS.find((item) => item.id === blockId);
              if (block) {
                addBlock(block, position);
              }
            }}
            onNodeMove={graph.moveNode}
            onNodeRemove={(id) => {
              graph.removeNode(id);
              if (id === selectedId) {
                setSheetOpen(false);
              }
            }}
            onSelectNode={openNode}
            selectedId={sheetOpen ? selectedId : undefined}
            toolbar={
              <Button
                aria-label="Minimap"
                aria-pressed={minimap}
                className="aria-pressed:bg-foreground/10 aria-pressed:text-foreground hidden md:inline-flex"
                onClick={() => setMinimap((value) => !value)}
                size="icon-sm"
                variant="ghost"
              >
                <MapIcon />
              </Button>
            }
          />
          <Tabs
            className="border-table-card-border h-44 shrink-0 gap-0 border-t"
            defaultValue="log"
          >
            <TabsList className="mx-2 mt-2" variant="line">
              <TabsTrigger value="log">Log</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent className="min-h-0 overflow-y-auto py-2" value="log">
              <WorkflowRunLog entries={log} />
            </TabsContent>
            <TabsContent
              className="min-h-0 overflow-y-auto p-3"
              value="timeline"
            >
              <WorkflowRunTimeline
                elapsedMs={run.elapsedMs}
                nodes={graph.nodes}
                phase={run.phase}
                schedule={run.schedule}
              />
            </TabsContent>
          </Tabs>
        </div>
      </WorkflowShellCard>
      <WorkflowNodeSheet
        log={log}
        node={selected}
        onDelete={(id) => {
          graph.removeNode(id);
          setSheetOpen(false);
        }}
        onBranchChange={(id, branch) => {
          run.stop();
          graph.updateNode(id, { branch });
        }}
        onModelChange={(id, model) => graph.updateNode(id, { model })}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        state={selected ? run.nodeState(selected.id) : undefined}
      />
    </WorkflowShell>
  );
}
