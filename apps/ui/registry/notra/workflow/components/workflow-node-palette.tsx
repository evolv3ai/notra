"use client";

import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import type { DragEvent } from "react";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import { WORKFLOW_BLOCK_MIME } from "../constants/workflow";
import type {
  WorkflowBlock,
  WorkflowNodePaletteProps,
} from "../types/workflow";
import { WorkflowBlockIcon } from "./workflow-block-icon";

const groupBlocks = (blocks: WorkflowBlock[]) => {
  const groups = new Map<string, WorkflowBlock[]>();
  for (const block of blocks) {
    groups.set(block.group, [...(groups.get(block.group) ?? []), block]);
  }
  return [...groups];
};

export const WorkflowNodePalette = ({
  blocks,
  className,
  onAdd,
  ...props
}: WorkflowNodePaletteProps) => {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? blocks.filter((block) =>
        `${block.title} ${block.description} ${block.group}`
          .toLowerCase()
          .includes(needle)
      )
    : blocks;

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, id: string) => {
    event.dataTransfer.setData(WORKFLOW_BLOCK_MIME, id);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={cn("flex min-h-0 flex-col", className)}
      data-slot="workflow-node-palette"
      {...props}
    >
      <div className="relative p-2">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-4.5 size-3.5 -translate-y-1/2" />
        <Input
          aria-label="Search blocks"
          className="h-8 pl-8 text-[0.8125rem]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocks"
          value={query}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-2 pb-3">
          {groupBlocks(visible).map(([group, items]) => (
            <section className="flex flex-col gap-0.5" key={group}>
              <h3 className="text-muted-foreground px-2 py-1 text-[0.6875rem] font-medium tracking-wide uppercase">
                {group}
              </h3>
              {items.map((block) => (
                <button
                  className="hover:bg-muted focus-visible:ring-ring/50 flex cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 active:cursor-grabbing"
                  data-slot="workflow-palette-item"
                  draggable
                  key={block.id}
                  onClick={() => onAdd?.(block)}
                  onDragStart={(event) => handleDragStart(event, block.id)}
                  type="button"
                >
                  <WorkflowBlockIcon block={block} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[0.8125rem] leading-5 font-medium">
                      {block.title}
                    </span>
                    <span className="text-muted-foreground truncate text-[0.6875rem] leading-4">
                      {block.description}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          ))}
          {visible.length === 0 && (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">
              No blocks match “{query}”.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
