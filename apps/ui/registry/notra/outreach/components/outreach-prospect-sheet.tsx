"use client";

import { CheckIcon, ExternalLinkIcon, MailIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  WORKFLOW_LOGOS,
  WorkflowLogo,
} from "../../workflow/components/workflow-logo";
import { WORKFLOW_SECTION_TITLE_CLASS } from "../../workflow/constants/workflow-ui";
import { getInitials } from "../lib/outreach";
import type { OutreachProspectSheetProps } from "../types/outreach";
import { OutreachSequence } from "./outreach-sequence";
import { OutreachStatusBadge } from "./outreach-status";

export const OutreachProspectSheet = ({
  onDraft,
  onMarkListed,
  prospect,
  ...props
}: OutreachProspectSheetProps) => (
  <Sheet {...props}>
    <SheetContent
      className="gap-0 sm:max-w-md"
      data-slot="outreach-prospect-sheet"
    >
      {prospect && (
        <>
          <SheetHeader className="border-foreground/10 gap-2 border-b p-4 pr-12">
            <OutreachStatusBadge status={prospect.status} />
            <SheetTitle className="text-base leading-snug break-words">
              {prospect.title}
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <a
                className="hover:text-foreground inline-flex min-w-0 items-center gap-1 break-all underline-offset-4 hover:underline"
                href={prospect.url}
                rel="noreferrer"
                target="_blank"
              >
                {prospect.domain}
                <ExternalLinkIcon className="size-3 shrink-0" />
              </a>
              <span className="whitespace-nowrap">
                · DR {prospect.domainRating}
              </span>
              <span className="whitespace-nowrap">· {prospect.updatedAt}</span>
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
            <section className="flex flex-col gap-2">
              <h3 className={WORKFLOW_SECTION_TITLE_CLASS}>
                Cited in AI answers
              </h3>
              <ul className="border-table-card-border bg-table-card divide-table-row-border divide-y rounded-xl border">
                {prospect.citations.map((citation) => (
                  <li
                    className="flex items-center gap-2.5 px-3 py-2 text-[0.8125rem]"
                    key={citation.engine}
                  >
                    <WorkflowLogo name={citation.engine} />
                    <span className="flex-1">
                      {WORKFLOW_LOGOS[citation.engine].label}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {citation.prompts} prompts
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className={WORKFLOW_SECTION_TITLE_CLASS}>
                Who's on the list
              </h3>
              <ol className="flex flex-col gap-1">
                {prospect.competitors
                  .toSorted((a, b) => a.position - b.position)
                  .map((competitor) => (
                    <li
                      className="flex items-center gap-2.5 text-[0.8125rem]"
                      key={competitor.name}
                    >
                      <span className="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded font-mono text-[0.6875rem]">
                        {competitor.position}
                      </span>
                      {competitor.name}
                    </li>
                  ))}
              </ol>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className={WORKFLOW_SECTION_TITLE_CLASS}>Contact</h3>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {getInitials(prospect.contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="text-[0.8125rem] font-medium">
                    {prospect.contact.name}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {prospect.contact.role}
                    </span>
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {prospect.contact.email} · from {prospect.contact.source}
                  </span>
                </div>
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className={WORKFLOW_SECTION_TITLE_CLASS}>Sequence</h3>
              {prospect.sequence.length > 0 ? (
                <OutreachSequence steps={prospect.sequence} />
              ) : (
                <p className="text-muted-foreground text-xs">
                  No emails yet. Draft a pitch to start the sequence.
                </p>
              )}
            </section>
          </div>
          <SheetFooter className="border-foreground/10 flex-row justify-end border-t p-3">
            {prospect.status !== "listed" && (
              <Button
                onClick={() => onMarkListed?.(prospect)}
                variant="outline"
              >
                <CheckIcon data-icon="inline-start" />
                Mark as listed
              </Button>
            )}
            <Button onClick={() => onDraft?.(prospect)}>
              <MailIcon data-icon="inline-start" />
              Draft pitch
            </Button>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  </Sheet>
);
