"use client";

import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import type { SkillCardProps } from "@/types/skills/page";
import {
  formatSkillUpdatedAt,
  hasSkillUpdate,
  skillDisplayName,
} from "@/utils/skills";

const SKILL_UPDATED_TITLE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
};

export function SkillCard({ skill, slug }: SkillCardProps) {
  const tCommon = useTranslations("common");
  const tUpdate = useTranslations("skills.update");
  const locale = useLocale();
  const label = skillDisplayName(skill.name);
  const machineName =
    label.toLowerCase().split(" ").join("-") === skill.name ? null : skill.name;
  const updatedAt = new Date(skill.updatedAt);
  const updatedAtTime = updatedAt.getTime();
  const relative =
    formatSkillUpdatedAt(skill.updatedAt, locale) ?? tCommon("labels.justNow");
  const [prefetch, setPrefetch] = useState<false | null>(false);
  const [tooltipReady, setTooltipReady] = useState(false);
  const absoluteTitle = tooltipReady
    ? new Date(updatedAtTime).toLocaleString(
        locale,
        SKILL_UPDATED_TITLE_OPTIONS
      )
    : undefined;

  function onCardPointerEnter() {
    setPrefetch(null);
    setTooltipReady(true);
  }

  return (
    <Link
      className="focus-visible:ring-ring block h-full w-full min-w-0 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      href={`/${slug}/skills/${skill.name}`}
      onFocus={() => setPrefetch(null)}
      onMouseEnter={onCardPointerEnter}
      prefetch={prefetch}
    >
      <article className="border-border/80 border-b-border/40 bg-muted/80 hover:border-border flex h-full flex-col gap-1.5 rounded-xl border p-1.5 shadow-2xs transition-colors">
        <div className="border-border/60 bg-background flex min-h-28 flex-1 flex-col overflow-hidden rounded-lg border">
          <div className="px-3 pt-2.5 pb-1">
            <div className="flex items-start justify-between gap-2">
              <h2
                className="min-w-0 truncate text-sm leading-snug font-medium"
                title={label}
              >
                {label}
              </h2>
              {hasSkillUpdate(skill.upstream) ? (
                <Badge className="shrink-0" variant="success">
                  <HugeiconsIcon
                    data-icon="inline-start"
                    icon={ArrowUp02Icon}
                  />
                  {tUpdate("badge")}
                </Badge>
              ) : null}
            </div>
            {machineName ? (
              <p className="text-muted-foreground truncate font-mono text-xs">
                {machineName}
              </p>
            ) : null}
          </div>
          <p className="text-muted-foreground mx-3 mt-1 mb-3 line-clamp-3 text-sm wrap-anywhere">
            {skill.description}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
          <Badge variant={skill.isSystem ? "secondary" : "outline"}>
            {skill.isSystem
              ? tCommon("labels.system")
              : tCommon("labels.customOwn")}
          </Badge>
          <time
            className="text-muted-foreground text-xs tabular-nums"
            dateTime={updatedAt.toISOString()}
            suppressHydrationWarning
            title={absoluteTitle}
          >
            {relative}
          </time>
        </div>
      </article>
    </Link>
  );
}
