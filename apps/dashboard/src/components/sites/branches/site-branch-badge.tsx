import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

import type { SiteBranchBadgeProps } from "@/types/site-branches";
import { siteBranchStateKey } from "@/utils/site-branch-state-key";

export function SiteBranchBadge({ live, pullRequest }: SiteBranchBadgeProps) {
  const t = useTranslations("sites.writing");
  if (!live) {
    return (
      <Badge shape="rounded" variant="outline">
        {t(`branchState.${siteBranchStateKey(pullRequest)}`)}
      </Badge>
    );
  }
  return (
    <Badge className="gap-1.5 ps-1.5" shape="rounded" variant="success">
      <span className="bg-success flex size-3.5 items-center justify-center rounded-[3px]">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-2.5 text-white"
          icon={Tick02Icon}
          strokeWidth={3}
        />
      </span>
      {t("live")}
    </Badge>
  );
}
