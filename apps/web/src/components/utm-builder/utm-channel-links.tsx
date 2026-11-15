import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@notra/ui/components/ui/button";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import { cn } from "@notra/ui/lib/utils";
import { DataTable, type TableColumn } from "ui/table";

import { UTM_CHANNEL_PRESETS } from "@/constants/utm-builder";
import { channelLinksCsv } from "@/lib/utm-builder/build";
import type { UtmChannelLink, UtmChannelLinksProps } from "@/types/utm-builder";

const CHANNEL_LINK_COLUMNS: TableColumn<UtmChannelLink>[] = [
  {
    key: "channel",
    header: "Channel",
    width: "12rem",
    cell: ({ preset }) => (
      <span className="flex flex-col">
        <span className="font-medium">{preset.label}</span>
        <span className="text-muted-foreground font-mono text-xs">
          {preset.source} / {preset.medium}
        </span>
      </span>
    ),
  },
  {
    key: "ga4",
    header: "GA4 channel",
    width: "9rem",
    cell: ({ result }) => result.classification?.channel ?? "-",
  },
  {
    key: "link",
    header: "Link",
    width: "1fr",
    cell: ({ result }) => (
      <span className="font-mono break-all">
        {result.url ??
          result.issues.find((issue) => issue.level === "error")?.message}
      </span>
    ),
  },
  {
    key: "copy",
    header: <span className="sr-only">Copy</span>,
    width: "4rem",
    align: "right",
    cell: ({ preset, result }) =>
      result.url ? (
        <CopyButton
          aria-label={`Copy ${preset.label} link`}
          size="icon-sm"
          value={result.url}
        />
      ) : null,
  },
];

export function UtmChannelLinks({
  links,
  selected,
  onToggle,
}: UtmChannelLinksProps) {
  const urls = links.flatMap(({ result }) => (result.url ? [result.url] : []));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {UTM_CHANNEL_PRESETS.map((preset) => {
          const active = selected.includes(preset.id);
          return (
            <button
              aria-pressed={active}
              className={cn(
                "inline-flex cursor-pointer items-center rounded-lg border px-2.5 py-1 font-sans text-[0.8125rem]/5 font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:border-primary hover:text-primary border-[#1E1E1E14] bg-white text-[#1E1E1E] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              )}
              key={preset.id}
              onClick={() => onToggle(preset.id)}
              type="button"
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {links.length > 0 ? (
        <div className="flex flex-col gap-3">
          <DataTable
            autoHeight
            columns={CHANNEL_LINK_COLUMNS}
            data={links}
            getRowId={(link) => link.preset.id}
            labels={{ table: "UTM links per channel" }}
            rowSizing="content"
          />
          {urls.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <CopyButton size="sm" value={urls.join("\n")} variant="outline">
                Copy all links
              </CopyButton>
              <a
                className={buttonVariants({ variant: "outline", size: "sm" })}
                download="utm-links.csv"
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(channelLinksCsv(links))}`}
              >
                <HugeiconsIcon data-icon="inline-start" icon={Download04Icon} />
                Download CSV
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
