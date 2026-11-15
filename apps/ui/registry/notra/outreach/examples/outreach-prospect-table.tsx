"use client";

import { toast } from "sonner";

import { OutreachProspectTable } from "../components/outreach-prospect-table";
import { OUTREACH_PROSPECTS } from "../constants/outreach";

export default function OutreachProspectTableExample() {
  return (
    <OutreachProspectTable
      className="w-full"
      onDraft={(prospect) => toast(`Drafting a pitch for ${prospect.domain}`)}
      onOpen={(prospect) => toast(prospect.title)}
      prospects={OUTREACH_PROSPECTS}
    />
  );
}
