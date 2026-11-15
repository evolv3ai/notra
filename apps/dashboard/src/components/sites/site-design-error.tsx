"use client";

import { useTranslations } from "use-intl";

import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import type { SiteDesignErrorProps } from "@/types/site-design-sections";

export function SiteDesignError({ path }: SiteDesignErrorProps) {
  const state = useSiteWorkspace();
  const t = useTranslations("sites.design.workspace");
  const issue = path
    ? state?.issues.find(
        (item) => item.path === path || item.path.startsWith(`${path}.`)
      )
    : null;
  return issue ? (
    <p className="text-destructive mt-2 text-xs" role="alert">
      {t("invalidField", { field: issue.path })}
    </p>
  ) : null;
}
