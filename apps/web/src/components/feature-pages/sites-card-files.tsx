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
import { SITES_FILES_CARD } from "@/constants/feature-pages/sites";

const HEADER_CLASS = "text-muted-foreground text-xs";
const READER_COL = "w-[9.5rem]";

export function SitesCardFiles() {
  const { frame, headers, rows } = SITES_FILES_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>{headers.file}</TableHead>
            <TableHead className={cn(HEADER_CLASS, READER_COL)}>
              {headers.reader}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.file}>
              <TableCell className="min-w-0 py-3.5">
                <span className="block truncate font-mono text-xs">
                  {row.file}
                </span>
              </TableCell>
              <TableCell className={cn("py-3.5", READER_COL)}>
                <Badge shape="rounded" size="md" variant="secondary">
                  {row.reader}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
