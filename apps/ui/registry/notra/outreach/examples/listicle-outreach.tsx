"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OutreachEmailDialog } from "../components/outreach-email-dialog";
import { OutreachProspectSheet } from "../components/outreach-prospect-sheet";
import { OutreachProspectTable } from "../components/outreach-prospect-table";
import { OutreachStats } from "../components/outreach-stats";
import {
  OUTREACH_DRAFTS,
  OUTREACH_PITCHABLE,
  OUTREACH_PROSPECTS,
  OUTREACH_STATS,
  OUTREACH_VARIABLES,
} from "../constants/outreach";
import type { OutreachFilter, OutreachProspect } from "../types/outreach";

const FILTERS: OutreachFilter[] = [
  { label: "All", statuses: [] },
  { label: "To pitch", statuses: ["found", "drafted"] },
  { label: "In sequence", statuses: ["sent", "opened", "replied"] },
  { label: "Won", statuses: ["listed"] },
];

export default function ListicleOutreach() {
  const [prospects, setProspects] = useState(OUTREACH_PROSPECTS);
  const [filter, setFilter] = useState("All");
  const [activeId, setActiveId] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const active = prospects.find((prospect) => prospect.id === activeId);
  const statuses = new Set(
    FILTERS.find((item) => item.label === filter)?.statuses
  );
  const visible =
    statuses.size === 0
      ? prospects
      : prospects.filter((prospect) => statuses.has(prospect.status));

  const updateProspect = (
    id: string,
    update: (prospect: OutreachProspect) => Partial<OutreachProspect>
  ) =>
    setProspects((current) =>
      current.map((prospect) =>
        prospect.id === id
          ? { ...prospect, ...update(prospect), updatedAt: "Just now" }
          : prospect
      )
    );

  const openSheet = (prospect: OutreachProspect) => {
    setActiveId(prospect.id);
    setSheetOpen(true);
  };

  const openDialog = (prospect: OutreachProspect) => {
    setActiveId(prospect.id);
    setSheetOpen(false);
    setDialogOpen(true);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">Listicle outreach</h2>
        <p className="text-muted-foreground text-sm">
          Best-of pages that AI answers quote, and where you stand on each.
        </p>
      </div>
      <OutreachStats stats={OUTREACH_STATS} />
      <Tabs onValueChange={(value) => setFilter(String(value))} value={filter}>
        <TabsList>
          {FILTERS.map((item) => (
            <TabsTrigger key={item.label} value={item.label}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <OutreachProspectTable
        emptyLabel="No listicles match this filter."
        onDraft={openDialog}
        onOpen={openSheet}
        prospects={visible}
      />
      <OutreachProspectSheet
        onDraft={openDialog}
        onMarkListed={(prospect) => {
          updateProspect(prospect.id, () => ({ status: "listed" }));
          toast.success(`${prospect.domain} marked as listed`);
        }}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        prospect={active}
      />
      <OutreachEmailDialog
        drafts={OUTREACH_DRAFTS}
        onOpenChange={setDialogOpen}
        onSend={(prospect, draft) => {
          updateProspect(prospect.id, (current) => ({
            sequence: [
              ...current.sequence,
              {
                at: "Just now",
                day: current.sequence.at(-1)?.day ?? 0,
                id: `s${current.sequence.length + 1}`,
                status: "sent",
                subject: draft.subject,
              },
            ],
            status: OUTREACH_PITCHABLE.has(current.status)
              ? "sent"
              : current.status,
          }));
          setDialogOpen(false);
          toast.success(`Sent “${draft.subject}” to ${prospect.contact.name}`);
        }}
        open={dialogOpen}
        prospect={active}
        variables={OUTREACH_VARIABLES}
      />
    </div>
  );
}
