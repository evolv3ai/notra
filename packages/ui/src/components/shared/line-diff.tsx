"use client";

import { useMemo } from "react";

import { collapseUnchanged, diffLines } from "@notra/ui/lib/line-diff";
import { cn } from "@notra/ui/lib/utils";
import type { LineDiffProps } from "@notra/ui/types/line-diff";

const LINE_PREFIX = { same: "", added: "+", removed: "−" } as const;

function defaultCollapsedLabel(count: number) {
  return `${count} unchanged ${count === 1 ? "line" : "lines"}`;
}

export function LineDiff({
  before,
  after,
  emptyLabel = "No changes.",
  collapsedLabel = defaultCollapsedLabel,
  className,
}: LineDiffProps) {
  const rows = useMemo(
    () => collapseUnchanged(diffLines(before, after)),
    [before, after]
  );

  if (before === after) {
    return (
      <p className="text-muted-foreground px-4 py-8 text-center text-sm">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto py-1.5 font-mono text-xs leading-5",
        className
      )}
    >
      {rows.map((row) =>
        row.type === "collapsed" ? (
          <div
            className="text-muted-foreground bg-muted/50 my-1 px-3 py-0.5 font-sans text-[11px] first:mt-0 last:mb-0"
            key={row.key}
          >
            {collapsedLabel(row.count)}
          </div>
        ) : (
          <div
            className={cn(
              "flex min-h-5 px-3",
              row.type === "added" && "bg-success/8",
              row.type === "removed" && "bg-destructive/8"
            )}
            key={row.key}
          >
            <span
              aria-hidden
              className={cn(
                "w-4 shrink-0 select-none",
                row.type === "added" && "text-success",
                row.type === "removed" && "text-destructive"
              )}
            >
              {LINE_PREFIX[row.type]}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 wrap-anywhere whitespace-pre-wrap",
                row.type === "removed" && "text-muted-foreground"
              )}
            >
              {row.type === "added" ? (
                <span className="sr-only">Added: </span>
              ) : null}
              {row.type === "removed" ? (
                <span className="sr-only">Removed: </span>
              ) : null}
              {row.text}
            </span>
          </div>
        )
      )}
    </div>
  );
}
