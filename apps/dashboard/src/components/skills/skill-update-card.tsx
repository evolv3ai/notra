"use client";

import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LineDiff } from "@notra/ui/components/shared/line-diff";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { SkillUpdateCardProps } from "@/types/skills/page";
import { skillDocument } from "@/utils/skills";

export function SkillUpdateCard({
  upstream,
  description,
  content,
  disabled,
  pending,
  onKeep,
  onApply,
}: SkillUpdateCardProps) {
  const t = useTranslations("skills.update");
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-background overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-1.5">
        <span className="bg-muted text-success flex size-7 shrink-0 items-center justify-center rounded-md">
          <HugeiconsIcon icon={ArrowUp02Icon} size={14} />
        </span>
        <p className="min-w-0 flex-1 basis-56 truncate text-sm">
          <span className="font-medium">
            {t("title", { version: upstream.latestVersion })}
          </span>
          {upstream.latest.note ? (
            <span className="text-muted-foreground">
              {" · "}
              {upstream.latest.note}
            </span>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            disabled={disabled}
            onClick={onKeep}
            size="sm"
            variant="ghost"
          >
            {t("keep")}
          </Button>
          {open ? (
            <Button
              disabled={disabled}
              loading={pending}
              onClick={onApply}
              size="sm"
            >
              {t("apply", { version: upstream.latestVersion })}
            </Button>
          ) : (
            <Button
              disabled={disabled}
              onClick={() => setOpen(true)}
              size="sm"
              variant="outline"
            >
              {t("review")}
            </Button>
          )}
        </div>
      </div>
      {open ? (
        <LineDiff
          after={skillDocument(
            upstream.latest.description,
            upstream.latest.content
          )}
          before={skillDocument(description, content)}
          className="max-h-[min(60vh,36rem)] overflow-y-auto border-t"
          collapsedLabel={(count) => t("unchanged", { count })}
        />
      ) : null}
    </section>
  );
}
