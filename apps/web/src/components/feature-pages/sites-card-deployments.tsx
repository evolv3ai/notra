import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Badge } from "@notra/ui/components/ui/badge";
import { cn } from "@notra/ui/lib/utils";

import { MockFrame } from "@/components/landing/mock-frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/marketing-table";
import {
  SITES_DEPLOYMENT_BADGES,
  SITES_DEPLOYMENTS_CARD,
  SITES_ENVIRONMENT_ICONS,
} from "@/constants/feature-pages/sites";
import { FEATURES_TABLE_OPTIONAL_COL } from "@/constants/landing/features";

const HEADER_CLASS = "text-muted-foreground text-xs";
const ENVIRONMENT_COL = "w-[8.5rem]";
const STATUS_COL = "w-28 @md:w-[10.5rem]";

export function SitesCardDeployments() {
  const { frame, headers, rows, live } = SITES_DEPLOYMENTS_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>{headers.deployment}</TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                ENVIRONMENT_COL
              )}
            >
              {headers.environment}
            </TableHead>
            <TableHead className={cn(HEADER_CLASS, STATUS_COL)}>
              {headers.status}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const badge = SITES_DEPLOYMENT_BADGES[row.status];
            return (
              <TableRow key={row.sha}>
                <TableCell className="min-w-0 py-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {row.title}
                    </span>
                    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-xs">
                      <span className="shrink-0">{row.sha}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{row.branch}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3",
                    FEATURES_TABLE_OPTIONAL_COL,
                    ENVIRONMENT_COL
                  )}
                >
                  <Badge shape="rounded" size="md" variant="secondary">
                    <HugeiconsIcon
                      icon={SITES_ENVIRONMENT_ICONS[row.environment]}
                      strokeWidth={1.5}
                    />
                    {row.environment}
                  </Badge>
                </TableCell>
                <TableCell className={cn("py-3", STATUS_COL)}>
                  {"live" in row ? (
                    <Badge shape="rounded" size="md" variant="success">
                      {live}
                    </Badge>
                  ) : (
                    <StatusBadge
                      appearance={badge.appearance}
                      label={badge.label}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
