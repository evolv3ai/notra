"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { OutreachProspectSheet } from "../components/outreach-prospect-sheet";
import { OUTREACH_PROSPECTS } from "../constants/outreach";

const PROSPECT = OUTREACH_PROSPECTS[1];

export default function OutreachProspectSheetExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Open devtools.fm
      </Button>
      <OutreachProspectSheet
        onDraft={(prospect) => toast(`Drafting a pitch for ${prospect.domain}`)}
        onMarkListed={(prospect) =>
          toast.success(`${prospect.domain} marked as listed`)
        }
        onOpenChange={setOpen}
        open={open}
        prospect={PROSPECT}
      />
    </>
  );
}
