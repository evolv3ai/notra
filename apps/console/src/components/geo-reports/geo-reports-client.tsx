"use client";

import { Link04Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { Button as UiButton } from "@notra/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/button";
import { BrandLogo } from "@/components/geo-reports/brand-logo";
import { DeleteReportDialog } from "@/components/geo-reports/delete-report-dialog";
import {
  GEO_DEFAULT_SECTION_STATE,
  GEO_STATUS_LABELS,
} from "@/constants/geo-report";
import type {
  GeoReportListItem,
  GeoReportsClientProps,
} from "@/types/geo-report";
import { buildGeoSharePath, formatReportDate } from "@/utils/geo-report";

const LOGO_SIZE = 32;

function statusVariant(status: GeoReportListItem["status"]) {
  if (status === "ready") {
    return "default" as const;
  }
  if (status === "sent") {
    return "outline" as const;
  }
  return "secondary" as const;
}

function editorHref(slug: string, item: GeoReportListItem) {
  return item.kind === "example"
    ? `/${slug}/geo-reports/new?example=1`
    : `/${slug}/geo-reports/${item.id}`;
}

async function copyShareLink(item: GeoReportListItem) {
  const token = item.kind === "example" ? item.id : item.shareToken;
  if (!token) {
    return;
  }
  const url = `${window.location.origin}${buildGeoSharePath(token, GEO_DEFAULT_SECTION_STATE)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch {
    toast.error("Could not copy the link");
  }
}

export function GeoReportsClient({ reports, slug }: GeoReportsClientProps) {
  const router = useRouter();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GEO reports</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Build a report for a prospect and send them the link.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href={`/${slug}/geo-reports/new`} />}
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          New report
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Models</TableHead>
              <TableHead className="text-right">Prompts</TableHead>
              <TableHead className="text-right">Visibility</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((item) => (
              <TableRow key={`${item.kind}-${item.id}`}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    {item.company.domain ? (
                      <BrandLogo
                        domain={item.company.domain}
                        name={item.company.name || item.company.domain}
                        size={LOGO_SIZE}
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        {item.company.name || "Untitled"}
                        {item.kind === "example" ? (
                          <Badge variant="outline">Example</Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.company.domain || "No domain yet"}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status)}>
                    {GEO_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.modelsTested}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.promptsTracked}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.visibilityScore ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatReportDate(item.updatedAt)}
                </TableCell>
                <TableCell>
                  <span className="flex items-center justify-end gap-1">
                    <UiButton
                      onClick={() => copyShareLink(item)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <HugeiconsIcon icon={Link04Icon} />
                      <span className="sr-only">Copy link</span>
                    </UiButton>
                    {item.kind === "saved" ? (
                      <DeleteReportDialog
                        companyName={item.company.name}
                        onDeleted={() => router.refresh()}
                        reportId={item.id}
                        size="icon-sm"
                        slug={slug}
                      />
                    ) : null}
                    <UiButton
                      nativeButton={false}
                      render={<Link href={editorHref(slug, item)} />}
                      size="sm"
                      variant="outline"
                    >
                      Open
                    </UiButton>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
