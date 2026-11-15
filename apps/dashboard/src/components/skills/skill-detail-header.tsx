"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { BackLink } from "@/components/layout/back-link";
import type { SkillDetailHeaderProps } from "@/types/skills/page";
import { skillDisplayName } from "@/utils/skills";

export function SkillDetailHeader({
  slug,
  name,
  isSystem,
  canDelete,
  deleteDisabled,
  onDelete,
}: SkillDetailHeaderProps) {
  const t = useTranslations("skills");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const label = skillDisplayName(name);
  const machineName =
    label.toLowerCase().split(" ").join("-") === name ? null : name;
  return (
    <div className="space-y-3">
      <BackLink href={`/${slug}/skills`}>{tCommon2("labels.skills")}</BackLink>

      <PageHeading
        description={
          machineName ? (
            <span className="font-mono text-xs">{machineName}</span>
          ) : null
        }
        title={
          <span className="inline-flex max-w-full items-center gap-2.5">
            <span className="min-w-0 truncate" title={label}>
              {label}
            </span>
            {isSystem ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Badge className="whitespace-nowrap" variant="secondary">
                        {tCommon2("labels.system")}
                      </Badge>
                    }
                  />
                  <TooltipContent>{t("detail.systemTooltip")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </span>
        }
      >
        {canDelete ? (
          <Button
            disabled={deleteDisabled}
            onClick={onDelete}
            variant="destructive"
          >
            <HugeiconsIcon className="size-4" icon={Delete02Icon} />
            {tCommon("delete")}
          </Button>
        ) : null}
      </PageHeading>
    </div>
  );
}
