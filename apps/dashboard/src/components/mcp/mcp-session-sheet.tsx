"use client";

import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import {
  McpPayloadSnippets,
  McpRequestStatusBadge,
} from "@/components/mcp/mcp-request-sheet";
import { useMcpSession } from "@/lib/hooks/use-mcp-analytics";
import type {
  McpSessionEventItemProps,
  McpSessionSheetProps,
} from "@/types/mcp-analytics";
import { formatBytes, formatMilliseconds } from "@/utils/format";
import { sessionDurationSeconds } from "@/utils/mcp-analytics";

function McpSessionEventItem({ event, startedAt }: McpSessionEventItemProps) {
  const locale = useLocale();
  const t = useTranslations("geo.pages.mcp.sessionSheet");
  const offset = Math.max(
    0,
    Math.round((Date.parse(event.capturedAt) - startedAt) / 1000)
  );
  return (
    <li className="relative space-y-1.5">
      <span
        aria-hidden="true"
        className={`absolute -start-[1.3rem] top-1.5 size-2 rounded-full ${event.status === "ok" ? "bg-muted-foreground/40" : "bg-destructive"}`}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground w-12 shrink-0 text-xs tabular-nums">
          +{offset}s
        </span>
        <span className="font-mono">{event.method}</span>
        {event.target ? (
          <span className="text-muted-foreground min-w-0 truncate font-mono">
            {event.target}
          </span>
        ) : null}
        <McpRequestStatusBadge entry={event} />
        <span className="text-muted-foreground ms-auto text-xs tabular-nums">
          {formatMilliseconds(event.durationMs, locale)} ·{" "}
          {formatBytes(event.responseBytes, locale)}
        </span>
      </div>
      {event.intent ? (
        <p className="text-muted-foreground ps-14 text-sm">"{event.intent}"</p>
      ) : null}
      {event.errorMessage ? (
        <p className="text-destructive ps-14 text-sm break-words">
          {event.errorMessage}
        </p>
      ) : null}
      {event.arguments || event.response ? (
        <details className="ps-14">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            {t("payload")}
          </summary>
          <div className="mt-2 space-y-2">
            <McpPayloadSnippets
              arguments={event.arguments}
              response={event.response}
            />
          </div>
        </details>
      ) : null}
    </li>
  );
}

export function McpSessionSheet({
  organizationId,
  range,
  session,
  open,
  onOpenChange,
}: McpSessionSheetProps) {
  const format = useFormatter();
  const t = useTranslations("geo.pages.mcp");
  const { data, isPending } = useMcpSession(
    organizationId,
    range,
    session?.id ?? null
  );
  const startedAt = session ? Date.parse(session.startedAt) : 0;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <DetailSheetContent size="lg">
        {session ? (
          <>
            <SheetHeader>
              <SheetTitle>
                <span className="me-10 block truncate">
                  {t("sessionSheet.title", {
                    client: session.clientName || t("fallback.unknownClient"),
                  })}
                </span>
              </SheetTitle>
              <SheetDescription>
                {format.dateTime(new Date(session.startedAt), {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}{" "}
                · {t("sessionSheet.requests", { count: session.requests })} ·{" "}
                {t("seconds", {
                  count: sessionDurationSeconds(
                    session.startedAt,
                    session.endedAt
                  ),
                })}
                {session.userId ? ` · ${session.userId}` : null}
                {session.model ? ` · ${session.model}` : null}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">
              <p className="text-muted-foreground mb-4 font-mono text-xs break-all">
                {t("sessionSheet.sessionId", { id: session.id })}
              </p>
              {isPending ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : (
                <ol className="border-border space-y-4 border-s ps-4">
                  {(data?.events ?? []).map((event) => (
                    <McpSessionEventItem
                      event={event}
                      key={event.id}
                      startedAt={startedAt}
                    />
                  ))}
                </ol>
              )}
            </div>
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}
