"use client";

import { cn } from "cn";
import { MailIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../table/components/table";
import { OUTREACH_MAX_COMPETITORS } from "../constants/outreach";
import type { OutreachProspectTableProps } from "../types/outreach";
import { OutreachCitations, OutreachStatusBadge } from "./outreach-status";

export const OutreachProspectTable = ({
  className,
  onDraft,
  emptyLabel = "No listicles yet.",
  onOpen,
  prospects,
  ...props
}: OutreachProspectTableProps) => (
  <div
    className={cn("min-w-0", className)}
    data-slot="outreach-prospect-table"
    {...props}
  >
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Listicle</TableHead>
          <TableHead className="hidden md:table-cell">Cited by</TableHead>
          <TableHead className="hidden lg:table-cell">
            Competitors listed
          </TableHead>
          <TableHead className="hidden text-right sm:table-cell">DR</TableHead>
          <TableHead className="hidden sm:table-cell">Status</TableHead>
          <TableHead className="relative w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prospects.length === 0 && (
          <TableRow>
            <TableCell
              className="text-muted-foreground h-24 text-center"
              colSpan={6}
            >
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
        {prospects.map((prospect) => (
          <TableRow
            className={cn(onOpen && "cursor-pointer")}
            data-status={prospect.status}
            key={prospect.id}
            onClick={() => onOpen?.(prospect)}
          >
            <TableCell className="w-full max-w-0 sm:w-auto sm:max-w-72">
              <button
                className="flex w-full min-w-0 flex-col text-left outline-none focus-visible:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen?.(prospect);
                }}
                type="button"
              >
                <span className="truncate font-medium">{prospect.title}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {prospect.domain}
                </span>
                <OutreachStatusBadge
                  className="mt-1.5 mb-1 sm:hidden"
                  status={prospect.status}
                />
              </button>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <OutreachCitations citations={prospect.citations} />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <span className="flex flex-wrap gap-1">
                {prospect.competitors
                  .slice(0, OUTREACH_MAX_COMPETITORS)
                  .map((competitor) => (
                    <span
                      className={cn(
                        "bg-muted rounded-md px-1.5 py-0.5 text-[0.6875rem]",
                        competitor.name === "Notra" &&
                          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      )}
                      key={competitor.name}
                    >
                      #{competitor.position} {competitor.name}
                    </span>
                  ))}
                {prospect.competitors.length > OUTREACH_MAX_COMPETITORS && (
                  <span className="text-muted-foreground px-1 py-0.5 text-[0.6875rem]">
                    +{prospect.competitors.length - OUTREACH_MAX_COMPETITORS}
                  </span>
                )}
              </span>
            </TableCell>
            <TableCell className="hidden text-right font-mono text-xs tabular-nums sm:table-cell">
              {prospect.domainRating}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <OutreachStatusBadge status={prospect.status} />
            </TableCell>
            <TableCell>
              {(prospect.status === "found" ||
                prospect.status === "drafted") && (
                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDraft?.(prospect);
                  }}
                  size="xs"
                  variant="outline"
                >
                  <MailIcon data-icon="inline-start" />
                  Pitch
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
