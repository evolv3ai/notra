"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import Link from "next/link";

import { Button } from "@/components/button";
import { ADOPTION_STATS } from "@/constants/skills";
import type { SystemSkillHeaderProps } from "@/types/skills";

export function SystemSkillHeader({
  slug,
  skill,
  hasChanges,
  pending,
  nextVersion,
  onDiscard,
  onPublish,
}: SystemSkillHeaderProps) {
  return (
    <header className="bg-background sticky top-0 z-10 -mx-4 -mt-6 flex flex-wrap items-start justify-between gap-4 border-b px-4 pt-6 pb-4 lg:-mx-6 lg:px-6">
      <div className="min-w-0">
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          href={`/${slug}/skills`}
        >
          <HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
          System Skills
        </Link>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <h1 className="truncate font-mono text-2xl font-semibold tracking-tight">
            {skill ? skill.name : "New system skill"}
          </h1>
          {skill ? (
            <Badge className="tabular-nums" variant="secondary">
              v{skill.version}
            </Badge>
          ) : null}
        </div>
        {skill ? (
          <dl className="text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {ADOPTION_STATS.map((stat) => (
              <div className="flex items-baseline gap-1.5" key={stat.key}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-foreground font-medium tabular-nums">
                  {skill.adoption[stat.key]}
                </dd>
                <span aria-hidden>{stat.label}</span>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">
            Publishing adds the skill to every workspace that has no skill with
            this name.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {skill && hasChanges ? (
          <span className="text-muted-foreground mr-1 flex items-center gap-1.5 text-sm">
            <span aria-hidden className="bg-info size-1.5 rounded-full" />
            Unsaved changes
          </span>
        ) : null}
        {skill && hasChanges ? (
          <Button disabled={pending} onClick={onDiscard} variant="ghost">
            Discard
          </Button>
        ) : null}
        <Button disabled={!hasChanges || pending} onClick={onPublish}>
          Publish v{nextVersion}
        </Button>
      </div>
    </header>
  );
}
