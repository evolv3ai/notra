"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_SUSPENSION_CATEGORY_LABELS } from "@notra/sites-core/constants/sites";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { OrganizationSuspendActions } from "@/components/moderation/organization-suspend-dialog";
import { UserBanDialog } from "@/components/moderation/user-ban-dialog";
import { SiteQueryError } from "@/components/sites/site-query-error";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import {
  ABUSE_ACTION_LABELS,
  MODERATION_SEARCH_DEBOUNCE_MS,
} from "@/constants/moderation";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  ModerationTableProps,
  RestrictionStatusProps,
} from "@/types/moderation";
import { isWorkspaceActionUnfinished } from "@/utils/moderation-outcome";

type ModerationTab = "organizations" | "users" | "history";

const TABS: { value: ModerationTab; label: string }[] = [
  { value: "organizations", label: "Workspaces" },
  { value: "users", label: "Users" },
  { value: "history", label: "Audit log" },
];

function LoadingRows() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      {[0, 1, 2].map((item) => (
        <Skeleton className="h-8 w-full" key={item} />
      ))}
    </div>
  );
}

function EmptyRows({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
      {children}
    </p>
  );
}

function ModerationTable({
  columns,
  action = false,
  children,
}: ModerationTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
            {action ? (
              <TableHead className="text-right">Action</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function RestrictionStatus({
  restricted,
  label,
  reason,
}: RestrictionStatusProps) {
  if (!restricted) {
    return <span className="text-muted-foreground text-sm">Active</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <Badge className="w-fit rounded-md" variant="destructive">
        {label}
      </Badge>
      <span
        className="text-muted-foreground truncate text-xs"
        title={reason ?? undefined}
      >
        {reason}
      </span>
    </div>
  );
}

function OrganizationsTable({ search }: { search: string }) {
  const query = useQuery({
    ...consoleOrpc.moderation.organizations.queryOptions({ input: { search } }),
    placeholderData: keepPreviousData,
  });
  if (query.isError && !query.data) {
    return (
      <SiteQueryError
        message="Could not load workspaces."
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!query.data) {
    return <LoadingRows />;
  }
  if (query.data.length === 0) {
    return <EmptyRows>No workspaces match.</EmptyRows>;
  }
  return (
    <ModerationTable columns={["Workspace", "Sites", "Status"]} action>
      {query.data.map((organization) => (
        <TableRow key={organization.id}>
          <TableCell>
            <div className="font-medium">{organization.name}</div>
            <div className="text-muted-foreground font-mono text-xs">
              {organization.slug}
            </div>
          </TableCell>
          <TableCell className="tabular-nums">
            {organization.siteCount}
          </TableCell>
          <TableCell className="max-w-72">
            <RestrictionStatus
              label="Suspended"
              reason={organization.suspendedReason}
              restricted={organization.suspendedAt !== null}
            />
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <OrganizationSuspendActions
                organizationId={organization.id}
                organizationName={organization.name}
                suspended={organization.suspendedAt !== null}
                unfinished={isWorkspaceActionUnfinished(
                  organization.suspendedAt !== null,
                  organization
                )}
              />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </ModerationTable>
  );
}

function UsersTable({ search }: { search: string }) {
  const query = useQuery({
    ...consoleOrpc.moderation.users.queryOptions({ input: { search } }),
    placeholderData: keepPreviousData,
  });
  if (query.isError && !query.data) {
    return (
      <SiteQueryError
        message="Could not load users."
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!query.data) {
    return <LoadingRows />;
  }
  if (query.data.length === 0) {
    return <EmptyRows>No users match.</EmptyRows>;
  }
  return (
    <ModerationTable columns={["User", "Workspaces owned", "Status"]} action>
      {query.data.map((user) => (
        <TableRow key={user.id}>
          <TableCell>
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground text-xs">{user.email}</div>
          </TableCell>
          <TableCell className="tabular-nums">
            {user.ownedOrganizations}
          </TableCell>
          <TableCell className="max-w-72">
            <RestrictionStatus
              label="Banned"
              reason={user.banReason}
              restricted={user.banned}
            />
          </TableCell>
          <TableCell className="text-right">
            <UserBanDialog user={user} />
          </TableCell>
        </TableRow>
      ))}
    </ModerationTable>
  );
}

function HistoryTable() {
  const query = useQuery(consoleOrpc.moderation.history.queryOptions());
  if (query.isError && !query.data) {
    return (
      <SiteQueryError
        message="Could not load the audit log."
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!query.data) {
    return <LoadingRows />;
  }
  if (query.data.length === 0) {
    return <EmptyRows>No suspensions or bans yet.</EmptyRows>;
  }
  return (
    <ModerationTable columns={["When", "Action", "Subject", "Reason", "By"]}>
      {query.data.map((entry) => (
        <TableRow key={entry.id}>
          <TableCell className="text-muted-foreground text-sm">
            <SiteRelativeTime date={entry.createdAt} />
          </TableCell>
          <TableCell className="text-sm">
            {ABUSE_ACTION_LABELS[entry.subjectType][entry.action] ??
              entry.action}
            {entry.retry ? " (retry)" : ""}
          </TableCell>
          <TableCell className="text-sm">
            {entry.subjectLabel ?? (
              <span className="text-muted-foreground font-mono text-xs">
                {entry.subjectId}
              </span>
            )}
          </TableCell>
          <TableCell className="max-w-80 text-sm">
            {entry.category ? (
              <div className="text-muted-foreground text-xs">
                {SITE_SUSPENSION_CATEGORY_LABELS[entry.category]}
              </div>
            ) : null}
            <div className="truncate" title={entry.reason ?? undefined}>
              {entry.reason}
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">
            {entry.actorName ?? "Deleted user"}
          </TableCell>
        </TableRow>
      ))}
    </ModerationTable>
  );
}

export function ModerationClient() {
  const [tab, setTab] = useState<ModerationTab>("organizations");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      MODERATION_SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>
        <p className="text-muted-foreground text-sm">
          Suspend workspaces and ban users for abuse. Every action needs a
          reason and is kept in the audit log for 2 years.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          onValueChange={(value: ModerationTab) => {
            // Each tab searches something different, so start it empty.
            setTab(value);
            setSearch("");
            setDebouncedSearch("");
          }}
          value={tab}
        >
          <TabsList
            aria-label="Moderation views"
            className="group-data-[orientation=horizontal]/tabs:h-8"
          >
            {TABS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab === "history" ? null : (
          <InputGroup className="sm:w-72">
            <InputGroupAddon>
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={Search01Icon}
              />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={
                tab === "users" ? "Search users" : "Search workspaces"
              }
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                tab === "users"
                  ? "Name, email or user ID"
                  : "Name, slug or workspace ID"
              }
              value={search}
            />
          </InputGroup>
        )}
      </div>
      {tab === "organizations" ? (
        <OrganizationsTable search={debouncedSearch} />
      ) : null}
      {tab === "users" ? <UsersTable search={debouncedSearch} /> : null}
      {tab === "history" ? <HistoryTable /> : null}
    </main>
  );
}
