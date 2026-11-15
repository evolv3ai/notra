"use client";

import { LineDiff } from "@notra/ui/components/shared/line-diff";
import { Badge } from "@notra/ui/components/ui/badge";
import { useState } from "react";

import { Button } from "@/components/button";
import type { SystemSkillVersionsProps } from "@/types/skills";
import { formatSkillDate } from "@/utils/skills";

export function SystemSkillVersions({
  skill,
  onLoad,
}: SystemSkillVersionsProps) {
  const [openVersion, setOpenVersion] = useState<number | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Versions</h2>
      <ol className="flex flex-col divide-y rounded-lg border">
        {skill.versions.map((version, index) => {
          const previous = skill.versions[index + 1];
          const isOpen = openVersion === version.version;
          return (
            <li className="flex flex-col gap-3 px-4 py-3" key={version.version}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium tabular-nums">
                    v{version.version}
                    {version.version === skill.version ? (
                      <Badge className="ml-2" variant="outline">
                        Current
                      </Badge>
                    ) : null}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      ·{" "}
                      <time
                        dateTime={version.createdAt}
                        suppressHydrationWarning
                      >
                        {formatSkillDate(version.createdAt)}
                      </time>
                      {version.publishedBy ? ` · ${version.publishedBy}` : ""}
                    </span>
                  </p>
                  {version.note ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {version.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {previous ? (
                    <Button
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenVersion(isOpen ? null : version.version)
                      }
                      size="sm"
                      variant="ghost"
                    >
                      {isOpen ? "Hide changes" : "Show changes"}
                    </Button>
                  ) : null}
                  {version.version === skill.version ? null : (
                    <Button
                      onClick={() => onLoad(version)}
                      size="sm"
                      variant="ghost"
                    >
                      Load into editor
                    </Button>
                  )}
                </div>
              </div>
              {isOpen && previous ? (
                <div className="overflow-hidden rounded-lg border">
                  <LineDiff after={version.content} before={previous.content} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
