"use client";

import { MailIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { OutreachEmailDialog } from "../components/outreach-email-dialog";
import {
  OUTREACH_DRAFTS,
  OUTREACH_PROSPECTS,
  OUTREACH_VARIABLES,
} from "../constants/outreach";

const [PROSPECT] = OUTREACH_PROSPECTS;

export default function OutreachEmailDialogExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MailIcon data-icon="inline-start" />
        Pitch saasbase.dev
      </Button>
      <OutreachEmailDialog
        drafts={OUTREACH_DRAFTS}
        onOpenChange={setOpen}
        onSend={(prospect, draft) => {
          setOpen(false);
          toast.success(`Sent “${draft.subject}” to ${prospect.contact.name}`);
        }}
        open={open}
        prospect={PROSPECT}
        variables={OUTREACH_VARIABLES}
      />
    </>
  );
}
