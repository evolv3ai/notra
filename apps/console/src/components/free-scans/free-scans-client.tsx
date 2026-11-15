"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import { Button } from "@notra/ui/components/ui/button";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { FREE_SCAN_MAX_PROMPT_LIMIT } from "@/constants/free-scans";
import { useFreeScanActions } from "@/hooks/use-free-scan-actions";
import { consoleOrpc } from "@/lib/orpc/query";
import type { FreeScanClaimRow, FreeScanFormState } from "@/types/free-scans";
import { formatSkillDate } from "@/utils/skills";

const EMPTY_FORM: FreeScanFormState = {
  domain: "",
  promptLimit: "15",
  organizationSlug: "",
};

function claimStatus(claim: FreeScanClaimRow) {
  if (claim.revokedAt) {
    return "Used";
  }
  return claim.claimedAt ? "Running" : "Available";
}

export function FreeScansClient() {
  const query = useQuery(consoleOrpc.freeScans.list.queryOptions());
  const { save, run } = useFreeScanActions();
  const [form, setForm] = useState<FreeScanFormState>(EMPTY_FORM);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(
      {
        domain: form.domain,
        promptLimit: Number(form.promptLimit),
        organizationSlug: form.organizationSlug.trim() || undefined,
      },
      { onSuccess: () => setForm(EMPTY_FORM) }
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Free Scans</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          One ChatGPT scan per company domain. Set a higher prompt limit before
          a company signs up or run a scan for a linked workspace.
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
        onSubmit={submit}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="free-scan-domain">Domain</Label>
          <Input
            id="free-scan-domain"
            onChange={(event) =>
              setForm({ ...form, domain: event.target.value })
            }
            placeholder="acme.com"
            required
            value={form.domain}
          />
        </div>
        <div className="flex w-32 flex-col gap-1.5">
          <Label htmlFor="free-scan-limit">Prompt limit</Label>
          <Input
            id="free-scan-limit"
            max={FREE_SCAN_MAX_PROMPT_LIMIT}
            min={1}
            onChange={(event) =>
              setForm({ ...form, promptLimit: event.target.value })
            }
            required
            type="number"
            value={form.promptLimit}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="free-scan-organization">Workspace slug</Label>
          <Input
            id="free-scan-organization"
            onChange={(event) =>
              setForm({ ...form, organizationSlug: event.target.value })
            }
            placeholder="Optional"
            value={form.organizationSlug}
          />
        </div>
        <Button disabled={save.isPending} type="submit">
          Save
        </Button>
      </form>

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}
      {query.isError ? (
        <div className="rounded-lg border p-4 text-sm" role="alert">
          Could not load free scans. {query.error.message}
        </div>
      ) : null}
      {query.data ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead className="text-right">Prompt limit</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Claimed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((claim) => (
              <TableRow key={claim.domain}>
                <TableCell>{claim.domain}</TableCell>
                <TableCell className="text-right">
                  {claim.promptLimit}
                </TableCell>
                <TableCell>
                  {claim.organizationName ?? (
                    <span className="text-muted-foreground">Not linked</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{claimStatus(claim)}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {claim.claimedAt ? (
                    <time dateTime={claim.claimedAt} suppressHydrationWarning>
                      {formatSkillDate(claim.claimedAt)}
                    </time>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() =>
                        setForm({
                          domain: claim.domain,
                          promptLimit: String(claim.promptLimit),
                          organizationSlug: claim.organizationSlug ?? "",
                        })
                      }
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={!claim.organizationSlug || run.isPending}
                      onClick={() => run.mutate({ domain: claim.domain })}
                      size="sm"
                    >
                      Run scan
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </main>
  );
}
