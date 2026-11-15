"use client";

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The scrollable log needs a tab stop for keyboard scrolling. */

import {
  ArrowDown01Icon,
  Copy01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  findMatches,
  groupBuildLog,
  logOffsets,
  matchOffsets,
  parseBuildLog,
  stripAnsi,
} from "@notra/sites-core/utils/build-log";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/button";
import { SiteBuildLogFilter } from "@/components/sites/site-build-log-filter";
import { SiteBuildLogRows } from "@/components/sites/site-build-log-rows";
import { SITE_BUILD_LOG_FOLLOW_THRESHOLD } from "@/constants/sites";
import type {
  SiteBuildLogCopyButtonProps,
  SiteBuildLogEmptyProps,
  SiteBuildLogsProps,
} from "@/types/sites";

const COPIED_RESET_MS = 1500;
const ICON_SWAP_TRANSITION = {
  type: "spring",
  duration: 0.3,
  bounce: 0,
} as const;

function BuildLogEmpty({
  inProgress,
  queued,
  showSpinner = true,
}: SiteBuildLogEmptyProps) {
  let message = "No build log for this deployment.";
  if (queued) {
    message = "Waiting for the build to start…";
  } else if (inProgress) {
    message = "Starting the build sandbox…";
  }
  return (
    <div className="text-muted-foreground flex h-full min-h-28 items-center justify-center gap-2 px-4 py-8 text-sm">
      {inProgress && showSpinner ? (
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4 motion-safe:animate-spin"
          icon={Loading03Icon}
          strokeWidth={1.75}
        />
      ) : null}
      {message}
    </div>
  );
}

function BuildLogCopyButton({ log }: SiteBuildLogCopyButtonProps) {
  const text = useMemo(() => (log ? stripAnsi(log) : ""), [log]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      toast.error("Could not copy the log");
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={copied ? "Log copied" : "Copy log"}
            disabled={!log}
            onClick={copy}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <LazyMotion features={domAnimation}>
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              className="inline-flex"
              exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              key={copied ? "copied" : "copy"}
              transition={ICON_SWAP_TRANSITION}
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={copied ? Tick02Icon : Copy01Icon}
                strokeWidth={1.75}
              />
            </m.span>
          </AnimatePresence>
        </LazyMotion>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Log copied" : "Copy log"}</TooltipContent>
    </Tooltip>
  );
}

export function SiteBuildLogs({
  log,
  heading,
  inProgress,
  queued,
  startAtEnd = false,
}: SiteBuildLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const followedLiveRef = useRef(inProgress || startAtEnd);
  const [following, setFollowing] = useState(true);
  const [query, setQuery] = useState("");

  const lines = useMemo(() => (log ? parseBuildLog(log) : []), [log]);
  const entries = useMemo(() => groupBuildLog(lines), [lines]);
  const offsets = useMemo(() => logOffsets(lines), [lines]);
  const trimmedQuery = query.trim();
  const matchingLines = useMemo(
    () =>
      trimmedQuery
        ? lines.filter(
            (line) => findMatches(line.text, trimmedQuery).length > 0
          )
        : [],
    [lines, trimmedQuery]
  );
  const matchingOffsets = useMemo(
    () => matchOffsets(lines, offsets, matchingLines),
    [lines, offsets, matchingLines]
  );

  useEffect(() => {
    if (inProgress) {
      followedLiveRef.current = true;
    }
    const element = scrollRef.current;
    if (
      element &&
      followedLiveRef.current &&
      followRef.current &&
      !trimmedQuery
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [log, inProgress, trimmedQuery]);

  const jumpToLatest = () => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }
    followRef.current = true;
    setFollowing(true);
  };

  const body =
    lines.length === 0 ? (
      <BuildLogEmpty
        inProgress={inProgress}
        queued={queued}
        showSpinner={!heading}
      />
    ) : (
      <div className="relative">
        <div
          aria-busy={inProgress}
          aria-label="Build log output"
          className={cn(
            "scrollbar-floating focus-visible:outline-ring overflow-auto py-2.5 font-mono text-xs leading-5 focus-visible:outline-2 focus-visible:-outline-offset-2",
            heading
              ? "max-h-48 min-h-24 group-data-[streaming=true]/log:h-48"
              : "max-h-[min(30rem,60vh)]"
          )}
          onScroll={(event) => {
            const element = event.currentTarget;
            const atBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              SITE_BUILD_LOG_FOLLOW_THRESHOLD;
            followRef.current = atBottom;
            setFollowing(atBottom);
          }}
          ref={scrollRef}
          role="log"
          tabIndex={0}
        >
          <SiteBuildLogRows
            entries={entries}
            matchOffsets={matchingOffsets}
            matchingLines={matchingLines}
            offsets={offsets}
            query={trimmedQuery}
          />
        </div>
        {inProgress && !following ? (
          <Button
            className="absolute right-3 bottom-3"
            onClick={jumpToLatest}
            size="xs"
            variant="outline"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={14}
              strokeWidth={1.75}
            />
            Jump to latest
          </Button>
        ) : null}
      </div>
    );

  const controls = (
    <div className="flex shrink-0 items-center gap-1">
      {lines.length > 0 ? (
        <SiteBuildLogFilter onChange={setQuery} value={query} />
      ) : null}
      <BuildLogCopyButton log={log} />
    </div>
  );

  if (heading) {
    return (
      <div
        className="group/log min-w-0"
        data-streaming={inProgress}
        data-timestamps={offsets.size > 0}
      >
        <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2 border-b py-1.5 ps-4 pe-2">
          <div className="min-w-0 flex-[1_1_12rem] text-sm tabular-nums">
            {heading}
          </div>
          {controls}
        </div>
        <div className="bg-background relative min-w-0 overflow-hidden">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/log min-w-0 space-y-3"
      data-streaming={inProgress}
      data-timestamps={offsets.size > 0}
    >
      <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="me-auto text-sm font-medium">Build logs</h2>
        {controls}
      </div>
      <div className="bg-muted/20 relative min-w-0 overflow-hidden rounded-md border">
        {body}
      </div>
    </div>
  );
}
