"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { cn } from "@notra/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@/components/button";
import { consoleOrpc } from "@/lib/orpc/query";
import type { SystemSkillsPageProps } from "@/types/skills";
import { formatSkillDate } from "@/utils/skills";

export function SystemSkillsClient({ slug }: SystemSkillsPageProps) {
  const query = useQuery(consoleOrpc.skills.list.queryOptions());

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            System Skills
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Built-in skills every workspace gets. Publishing a version updates
            every copy a workspace has not changed.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href={`/${slug}/skills/new`} />}
        >
          New skill
        </Button>
      </header>

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}
      {query.isError ? (
        <div className="rounded-lg border p-4 text-sm" role="alert">
          Could not load system skills. {query.error.message}
        </div>
      ) : null}
      {query.data ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Skill</TableHead>
              <TableHead className="text-right">Version</TableHead>
              <TableHead className="text-right">Workspaces</TableHead>
              <TableHead className="text-right">On latest</TableHead>
              <TableHead className="text-right">Customized</TableHead>
              <TableHead>Published</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((skill) => (
              <TableRow className="relative" key={skill.id}>
                <TableCell className="max-w-md">
                  <Link
                    className="focus-visible:after:ring-ring font-mono text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset"
                    href={`/${slug}/skills/${skill.name}`}
                  >
                    {skill.name}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">
                    {skill.description}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  v{skill.version}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    skill.adoption.copies === 0 && "text-muted-foreground"
                  )}
                >
                  {skill.adoption.copies}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    skill.adoption.onLatest === 0 && "text-muted-foreground"
                  )}
                >
                  {skill.adoption.onLatest}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    skill.adoption.customized === 0 && "text-muted-foreground"
                  )}
                >
                  {skill.adoption.customized}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  <time dateTime={skill.updatedAt} suppressHydrationWarning>
                    {formatSkillDate(skill.updatedAt)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </main>
  );
}
