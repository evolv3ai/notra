"use client";

import { Image01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";

import type { BlockPreviewProps } from "@/types/content/block-picker";

function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-muted-foreground/15 block h-1.5 rounded-full",
        className
      )}
    />
  );
}

function TextLines() {
  return (
    <>
      <Bar className="w-full" />
      <Bar className="w-4/5" />
    </>
  );
}

function PreviewBody({ kind }: BlockPreviewProps) {
  switch (kind) {
    case "heading1":
    case "heading2":
    case "heading3": {
      return (
        <>
          <span
            className={cn(
              "bg-muted-foreground/35 block rounded-full",
              kind === "heading1" && "h-3.5 w-3/5",
              kind === "heading2" && "h-3 w-1/2",
              kind === "heading3" && "h-2.5 w-2/5"
            )}
          />
          <TextLines />
        </>
      );
    }
    case "bulletedList":
    case "numberedList": {
      return (
        <>
          {["w-4/5", "w-3/5", "w-2/3"].map((width, index) => (
            <span className="flex items-center gap-1.5" key={width}>
              {kind === "bulletedList" ? (
                <span className="bg-muted-foreground/40 size-1.5 shrink-0 rounded-full" />
              ) : (
                <span className="text-muted-foreground/70 w-2.5 shrink-0 text-xs leading-none font-semibold tabular-nums">
                  {index + 1}.
                </span>
              )}
              <Bar className={width} />
            </span>
          ))}
        </>
      );
    }
    case "quote": {
      return (
        <span className="border-muted-foreground/40 flex flex-col gap-1.5 border-l-2 pl-2">
          <TextLines />
          <Bar className="w-1/3" />
        </span>
      );
    }
    case "codeBlock": {
      return (
        <span className="bg-foreground/85 flex flex-col gap-1.5 rounded-md p-2">
          <span className="flex gap-1">
            <span className="bg-chart-2/80 block h-1.5 w-1/5 rounded-full" />
            <span className="bg-background/40 block h-1.5 w-2/5 rounded-full" />
          </span>
          <span className="flex gap-1 pl-3">
            <span className="bg-chart-4/80 block h-1.5 w-1/4 rounded-full" />
            <span className="bg-background/40 block h-1.5 w-1/3 rounded-full" />
          </span>
          <span className="bg-background/40 block h-1.5 w-1/6 rounded-full" />
        </span>
      );
    }
    case "table": {
      return (
        <span className="border-muted-foreground/20 grid grid-cols-3 overflow-hidden rounded-sm border">
          {Array.from({ length: 9 }, (_, cell) => (
            <span
              className={cn(
                "border-muted-foreground/20 h-3 border-r border-b [&:nth-child(3n)]:border-r-0 [&:nth-child(n+7)]:border-b-0",
                cell < 3 && "bg-muted-foreground/15"
              )}
              key={cell}
            />
          ))}
        </span>
      );
    }
    case "image":
    case "video": {
      return (
        <span className="bg-muted-foreground/10 text-muted-foreground/60 flex h-12 items-center justify-center rounded-md">
          <HugeiconsIcon
            className="size-4"
            icon={kind === "image" ? Image01Icon : PlayIcon}
          />
        </span>
      );
    }
    case "divider": {
      return (
        <>
          <Bar className="w-3/4" />
          <span className="border-muted-foreground/30 my-0.5 block border-t" />
          <Bar className="w-2/3" />
        </>
      );
    }
    default: {
      return (
        <>
          <TextLines />
          <Bar className="w-3/5" />
        </>
      );
    }
  }
}

/** Small mock of the block, shown next to the slash menu. */
export function BlockPreview({ kind }: BlockPreviewProps) {
  return (
    <div
      aria-hidden="true"
      className="bg-muted flex h-28 items-center justify-center px-5"
    >
      <div className="bg-background flex w-full flex-col gap-1.5 rounded-lg border p-3 shadow-xs">
        <PreviewBody kind={kind} />
      </div>
    </div>
  );
}
