"use client";

import { BotIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { Button } from "../../button/components/button";
import { DataTable, type TableColumn } from "../components/data-table";

interface Visit {
  id: string;
  bot: string;
  path: string;
  status: number;
}

const SAMPLE_VISITS: Visit[] = [
  { id: "visit-1", bot: "GPTBot", path: "/pricing", status: 200 },
  { id: "visit-2", bot: "ClaudeBot", path: "/docs", status: 200 },
  { id: "visit-3", bot: "PerplexityBot", path: "/blog/ai-notes", status: 200 },
  { id: "visit-4", bot: "Googlebot", path: "/changelog", status: 404 },
];
const EMPTY_HEIGHT = 300;
const PREVIEW_MIN_HEIGHT = 296;

const columns: TableColumn<Visit>[] = [
  { key: "bot", header: "Crawler", width: "11rem" },
  { key: "path", header: "Page" },
  { key: "status", header: "Status", width: "6rem", align: "right" },
];

export default function DataTableEmptyExample() {
  const [visits, setVisits] = useState<Visit[]>([]);

  return (
    <div
      className="w-full max-w-2xl self-start"
      style={{ minHeight: PREVIEW_MIN_HEIGHT }}
    >
      <DataTable
        columns={columns}
        data={visits}
        emptyState={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BotIcon />
              </EmptyMedia>
              <EmptyTitle>No crawler visits yet</EmptyTitle>
              <EmptyDescription>
                Add the tracking snippet to your site and AI crawlers show up
                here as they read your pages.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setVisits(SAMPLE_VISITS)} size="sm">
                <PlusIcon />
                Add snippet
              </Button>
            </EmptyContent>
          </Empty>
        }
        getRowId={(row) => row.id}
        height={EMPTY_HEIGHT}
      />
    </div>
  );
}
