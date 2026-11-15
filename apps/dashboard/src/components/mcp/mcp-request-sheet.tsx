"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { CodeSnippet } from "@/components/geo/code-snippet";
import {
  JSON_RPC_ERROR_KEYS,
  MCP_ELICITATION_OUTCOME_VARIANTS,
} from "@/constants/mcp-analytics";
import type {
  McpPayloadSnippetsProps,
  McpRequestSheetProps,
  McpRequestStatusBadgeProps,
} from "@/types/mcp-analytics";
import { formatBytes, formatMilliseconds } from "@/utils/format";
import { elicitationOutcome, prettyJson } from "@/utils/mcp-analytics";

export function McpRequestStatusBadge({ entry }: McpRequestStatusBadgeProps) {
  const t = useTranslations("geo.pages.mcp");
  const outcome = elicitationOutcome(entry.outcome);
  if (entry.status === "ok" && outcome) {
    return (
      <Badge variant={MCP_ELICITATION_OUTCOME_VARIANTS[outcome]}>
        {t(`status.${outcome}`)}
      </Badge>
    );
  }
  if (entry.status === "ok") {
    return <Badge variant="success">{t("status.ok")}</Badge>;
  }
  if (entry.status === "tool_error") {
    return <Badge variant="warning">{t("status.toolError")}</Badge>;
  }
  const errorKey = JSON_RPC_ERROR_KEYS[entry.errorCode];
  return (
    <Badge variant="destructive">
      {errorKey
        ? t(`rpcErrors.${errorKey}`)
        : t("rpcErrors.other", { code: entry.errorCode })}
    </Badge>
  );
}

export function McpPayloadSnippets({
  arguments: args,
  response,
}: McpPayloadSnippetsProps) {
  const t = useTranslations("geo.pages.mcp.requestSheet");
  return (
    <>
      {args ? (
        <CodeSnippet code={prettyJson(args)} filename={t("arguments")} />
      ) : null}
      {response ? (
        <CodeSnippet code={prettyJson(response)} filename={t("response")} />
      ) : null}
    </>
  );
}

export function McpRequestSheet({
  entry,
  open,
  onOpenChange,
}: McpRequestSheetProps) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("geo.pages.mcp");
  const details: [string, string][] = entry
    ? [
        [
          t("requestSheet.client"),
          `${entry.clientName || t("fallback.unknown")} ${entry.clientVersion}`,
        ],
        [t("requestSheet.user"), entry.userId],
        [t("requestSheet.model"), entry.model],
        [
          t("requestSheet.responseSize"),
          formatBytes(entry.responseBytes, locale),
        ],
        [t("requestSheet.protocol"), entry.protocolVersion],
        [
          t("requestSheet.rpcError"),
          entry.status === "rpc_error" ? String(entry.errorCode) : "",
        ],
        [t("requestSheet.sessionId"), entry.sessionId],
      ]
    : [];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <DetailSheetContent size="md">
        {entry ? (
          <>
            <SheetHeader>
              <SheetTitle>
                <span className="me-10 flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-mono">
                    {entry.method}
                  </span>
                  <McpRequestStatusBadge entry={entry} />
                </span>
              </SheetTitle>
              <SheetDescription>
                {entry.target ? `${entry.target} · ` : null}
                {formatMilliseconds(entry.durationMs, locale)} ·{" "}
                {format.dateTime(new Date(entry.capturedAt), {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">
              {entry.intent ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    {t("requestSheet.intent")}:{" "}
                  </span>
                  {entry.intent}
                </p>
              ) : null}
              {entry.errorMessage ? (
                <p className="text-destructive text-sm break-words">
                  {entry.errorMessage}
                </p>
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {details
                  .filter(([, value]) => value.trim() !== "")
                  .map(([label, value]) => (
                    <div className="contents" key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="min-w-0 font-mono text-xs leading-5 break-all">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
              <McpPayloadSnippets
                arguments={entry.arguments}
                response={entry.response}
              />
            </div>
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}
