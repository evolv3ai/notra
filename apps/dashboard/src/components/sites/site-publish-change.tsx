"use client";

import {
  ArrowRight01Icon,
  File01Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { SiteFileDiff } from "@/components/sites/site-file-diff";
import { useSitePublishDiff } from "@/lib/hooks/use-site-publish-diff";
import { cn } from "@/lib/utils";
import type { SitePublishChangeProps } from "@/types/components/site-publish";
import { toErrorMessage } from "@/utils/error-message";

export function SitePublishChange({
  organizationId,
  siteId,
  branch,
  path,
  change,
  defaultOpen,
}: SitePublishChangeProps) {
  const t = useTranslations("sites.publish.changesList");
  const tEditor = useTranslations("sites.drafts");
  const writing = useTranslations("sites.writing");
  const { readQuery, highlighterReady, fileDiff, counts, binary, image } =
    useSitePublishDiff({
      organizationId,
      siteId,
      branch,
      path,
      change,
      defaultOpen,
    });
  let diff: ReactNode;
  if (readQuery.isPending || (!binary && !highlighterReady)) {
    diff = (
      <div aria-busy="true" className="space-y-2.5 px-4 py-3">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  } else if (readQuery.isError) {
    diff = (
      <p className="text-muted-foreground px-4 py-3 text-[13px]">
        {toErrorMessage(readQuery.error, tEditor("loadFailed"))}
      </p>
    );
  } else if (binary) {
    diff = image ? (
      <div className="bg-muted/40 flex justify-center p-3">
        <img
          alt=""
          className="max-h-60 max-w-full rounded-md object-contain outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          src={image}
        />
      </div>
    ) : null;
  } else {
    diff = fileDiff ? <SiteFileDiff fileDiff={fileDiff} /> : null;
  }

  return (
    <Collapsible className="group/change" defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="hover:bg-muted/50 focus-visible:ring-ring/50 flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset">
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground shrink-0 transition-transform duration-150 group-data-[open]/change:rotate-90 motion-reduce:transition-none"
          icon={ArrowRight01Icon}
          size={13}
          strokeWidth={2}
        />
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground shrink-0"
          icon={binary ? Image01Icon : File01Icon}
          size={15}
          strokeWidth={1.5}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono text-xs",
            change === "deleted" && "text-muted-foreground line-through"
          )}
          title={path}
        >
          {path === "blog.json" ? writing("settings") : path}
        </span>
        {change === "modified" ? null : (
          <span className="text-muted-foreground shrink-0 text-xs">
            {t(change)}
          </span>
        )}
        {counts ? (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums">
            <span className="text-success">+{counts.additions}</span>
            <span className="text-destructive">−{counts.deletions}</span>
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-72 overflow-y-auto overscroll-contain border-t">
        {diff}
      </CollapsibleContent>
    </Collapsible>
  );
}
