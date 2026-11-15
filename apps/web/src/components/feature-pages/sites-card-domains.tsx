import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
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
  SITES_DOMAIN_BADGES,
  SITES_DOMAINS_CARD,
} from "@/constants/feature-pages/sites";
import { FEATURES_TABLE_OPTIONAL_COL } from "@/constants/landing/features";

const HEADER_CLASS = "text-muted-foreground text-xs";
const SETUP_COL = "w-[8.5rem]";
const STATUS_COL = "w-[7.5rem]";

export function SitesCardDomains() {
  const { frame, headers, rows } = SITES_DOMAINS_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>{headers.domain}</TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                SETUP_COL
              )}
            >
              {headers.setup}
            </TableHead>
            <TableHead className={cn(HEADER_CLASS, STATUS_COL)}>
              {headers.status}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const badge = SITES_DOMAIN_BADGES[row.status];
            return (
              <TableRow key={row.domain}>
                <TableCell className="min-w-0 py-3.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <HugeiconsIcon
                      className="text-muted-foreground size-3.5 shrink-0"
                      icon={SquareLock02Icon}
                      strokeWidth={2}
                    />
                    <span className="truncate">{row.domain}</span>
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-muted-foreground py-3.5 text-sm",
                    FEATURES_TABLE_OPTIONAL_COL,
                    SETUP_COL
                  )}
                >
                  {row.setup}
                </TableCell>
                <TableCell className={cn("py-3.5", STATUS_COL)}>
                  <StatusBadge
                    appearance={badge.appearance}
                    label={badge.label}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
