"use client";

import { MinusSignIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { cn } from "@notra/ui/lib/utils";
import { type ReactNode, useState } from "react";
import { DataTable, type TableColumn } from "ui/table";

import { DesignSystemFrame } from "@/components/design-system/design-system-frame";
import { EngineIcon } from "@/components/geo/engine-icon";
import { DESIGN_SYSTEM_SCAN_ANSWERS } from "@/constants/design-system-scans";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { formatEngineFamily } from "@/utils/geo-charts";
import { paginatedTableHeightFor } from "@/utils/table";

const DAYS = [
  "15 Oct",
  "16 Oct",
  "17 Oct",
  "18 Oct",
  "19 Oct",
  "20 Oct",
  "21 Oct",
];
const USAGE = [
  {
    event: "AI input tokens",
    dotClass: "bg-success",
    values: ["13.1M", "12.9M", "191.9K", "10.6M", "12.9M", "92K", "0"],
    total: "59.6M",
  },
  {
    event: "AI output tokens",
    dotClass: "bg-warning",
    values: ["617.9K", "557.1K", "10K", "531.6K", "628.3K", "4.1K", "0"],
    total: "2.8M",
  },
  {
    event: "AI model calls",
    dotClass: "bg-primary",
    values: ["2.1K", "1.9K", "33", "2.6K", "2.4K", "18", "0"],
    total: "10.5K",
  },
];
const USAGE_TOTALS = [
  "13.7M",
  "13.5M",
  "201.9K",
  "11.1M",
  "13.5M",
  "96.1K",
  "0",
];

type Answer = (typeof DESIGN_SYSTEM_SCAN_ANSWERS)[number];

const ANSWER_COLUMNS: TableColumn<Answer>[] = [
  {
    key: "prompt",
    header: "Prompt",
    width: "1fr",
    minWidth: "14rem",
    sortable: true,
    cell: (row) => <span className="truncate font-medium">{row.prompt}</span>,
  },
  {
    key: "engine",
    header: "Model",
    width: "12rem",
    cell: (row) => (
      <span className="flex items-center gap-2">
        <EngineIcon className="size-3.5" engine={row.engine} />
        {formatEngineFamily(row.engine)}
      </span>
    ),
  },
  {
    key: "mentioned",
    header: "Mention",
    width: "11rem",
    cell: (row) => (
      <StatusBadge
        appearance={
          row.mentioned
            ? { variant: "success", icon: Tick02Icon }
            : { variant: "secondary", icon: MinusSignIcon }
        }
        label={row.mentioned ? "Mentioned" : "Not mentioned"}
      />
    ),
  },
  {
    key: "sources",
    header: "Sources",
    width: "6rem",
    align: "right",
    sortable: true,
  },
];

const RUNS = [
  {
    id: "r1",
    name: "Brand audit",
    status: "Success",
    duration: "1m 12s",
    owner: "Jan",
  },
  {
    id: "r2",
    name: "Weekly summary",
    status: "Queued",
    duration: "0m 32s",
    owner: "Dominik",
  },
  {
    id: "r3",
    name: "SEO scan",
    status: "Failed",
    duration: "2m 08s",
    owner: "Jan",
  },
  {
    id: "r4",
    name: "Changelog draft",
    status: "Success",
    duration: "0m 54s",
    owner: "Autopilot",
  },
];

const RUN_STATUS_VARIANT: Record<string, "success" | "info" | "destructive"> = {
  Success: "success",
  Queued: "info",
  Failed: "destructive",
};

const RUN_COLUMNS: TableColumn<(typeof RUNS)[number]>[] = [
  { key: "name", header: "Workflow", width: "1fr", sortable: true },
  {
    key: "status",
    header: "Status",
    width: "8rem",
    cell: (row) => (
      <StatusBadge
        appearance={{ variant: RUN_STATUS_VARIANT[row.status] ?? "secondary" }}
        label={row.status}
      />
    ),
  },
  { key: "owner", header: "Owner", width: "8rem" },
  { key: "duration", header: "Run time", width: "7rem", align: "right" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function TablesDesignSystemClientPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>(["r2"]);

  return (
    <DesignSystemFrame
      description="Every table style on one page, rendered from fixtures."
      title="Tables"
    >
      <Section
        description="Plain table primitives with a totals footer."
        title="Usage by day"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              {DAYS.map((day) => (
                <TableHead className="text-right" key={day}>
                  {day}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {USAGE.map((row) => (
              <TableRow key={row.event}>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <span className={cn("size-2.5 rounded-sm", row.dotClass)} />
                    {row.event}
                  </span>
                </TableCell>
                {row.values.map((value, index) => (
                  <TableCell className="text-right" key={DAYS[index]}>
                    {value}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <span className="font-semibold">{row.total}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground ml-5">Total</span>
              </TableCell>
              {USAGE_TOTALS.map((value, index) => (
                <TableCell className="text-right" key={DAYS[index]}>
                  <span className="text-muted-foreground">{value}</span>
                </TableCell>
              ))}
              <TableCell className="text-right">
                <span className="font-semibold">62.5M</span>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Section>

      <Section
        description="DataTable with sorting and client pagination."
        title="Scan answers"
      >
        <DataTable
          columns={ANSWER_COLUMNS}
          data={DESIGN_SYSTEM_SCAN_ANSWERS}
          getRowId={(row) => row.id}
          height={paginatedTableHeightFor(10)}
          pagination={{
            page,
            pageSize: 10,
            onPageChange: setPage,
            itemLabel: "answers",
          }}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </Section>

      <Section
        description="DataTable with row selection, sized to its rows."
        title="Workflow runs"
      >
        <DataTable
          autoHeight
          columns={RUN_COLUMNS}
          data={RUNS}
          getRowId={(row) => row.id}
          onSelectionChange={setSelected}
          rowHeight={TABLE_ROW_HEIGHT}
          selectable
          selectedRowIds={selected}
        />
      </Section>

      <Section description="DataTable without rows." title="Empty">
        <DataTable
          autoHeight
          columns={RUN_COLUMNS}
          data={[]}
          emptyState="No workflow runs yet."
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </Section>

      <Section
        description="DataTable while the first page loads."
        title="Loading"
      >
        <DataTable
          autoHeight
          columns={RUN_COLUMNS}
          data={[]}
          loading
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </Section>
    </DesignSystemFrame>
  );
}
