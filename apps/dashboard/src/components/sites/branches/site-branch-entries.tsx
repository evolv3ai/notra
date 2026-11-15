import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { NOTRA_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import type {
  SiteBranchEntryProps,
  SiteBranchMenuProps,
  SiteBranchScrollListProps,
} from "@/types/site-branches";
import { siteBranchLabels } from "@/utils/site-branch-label";

function SiteBranchEntryItem({
  entry,
  label,
  current,
  productionBranch,
  onSelect,
  onAction,
}: SiteBranchEntryProps) {
  const t = useTranslations("sites.branches");
  const writing = useTranslations("sites.writing");
  const live = entry.name === productionBranch;
  const active = entry.name === current;
  return (
    <div className="flex items-center gap-1">
      <DropdownMenuItem
        active={active}
        className="min-w-0 flex-1"
        onClick={() => onSelect(entry.name)}
        title={entry.name}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            active ? "font-medium" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {live ? (
          <Badge shape="rounded" variant="success">
            {writing("live")}
          </Badge>
        ) : null}
      </DropdownMenuItem>
      {!live && entry.name.startsWith(NOTRA_BRANCH_PREFIX) ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            aria-label={t("rowActions", { branch: label })}
            className="size-7 shrink-0 justify-center p-0 [&>svg:last-child]:hidden"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={MoreHorizontalIcon}
              size={14}
            />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => onAction({ kind: "rename", branch: entry.name })}
            >
              {t("rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onAction({ kind: "delete", branch: entry.name })}
            >
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
    </div>
  );
}

export function SiteBranchEntries(props: SiteBranchMenuProps) {
  const t = useTranslations("sites.branches");
  const writing = useTranslations("sites.writing");
  const locale = useLocale();
  if (props.loading) {
    return (
      <p aria-busy="true" className="text-muted-foreground px-3 py-3 text-sm">
        {t("loading")}
      </p>
    );
  }
  if (props.error) {
    return (
      <div className="space-y-2 p-3">
        <p role="alert" className="text-destructive text-sm">
          {t("statusFailed")}
        </p>
        <Button onClick={props.onRetry} size="sm" variant="outline">
          {writing("retry")}
        </Button>
      </div>
    );
  }
  const search = props.search.trim().toLocaleLowerCase(locale);
  const visible = props.entries.filter(
    (entry) =>
      entry.exists &&
      (entry.name === props.productionBranch ||
        entry.name.startsWith(NOTRA_BRANCH_PREFIX))
  );
  const labels = siteBranchLabels(visible, locale, (date) =>
    t("draftFrom", { date })
  );
  const entries = visible.filter(
    (entry) =>
      entry.name === props.productionBranch ||
      `${entry.name} ${labels.get(entry.name)}`
        .toLocaleLowerCase(locale)
        .includes(search)
  );
  if (!entries.length) {
    return (
      <p className="text-muted-foreground px-3 py-3 text-sm">
        {writing("noBranches")}
      </p>
    );
  }
  return (
    <SiteBranchScrollList count={entries.length}>
      {entries.map((entry) => (
        <SiteBranchEntryItem
          {...props}
          key={entry.name}
          entry={entry}
          label={labels.get(entry.name) ?? entry.name}
        />
      ))}
    </SiteBranchScrollList>
  );
}

/** Fades whichever edge still has branches scrolled out of view. */
function SiteBranchScrollList({ count, children }: SiteBranchScrollListProps) {
  const list = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const measure = () => {
    const element = list.current;
    if (!element) {
      return;
    }
    const top = element.scrollTop > 1;
    const bottom =
      element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    setEdges((previous) =>
      previous.top === top && previous.bottom === bottom
        ? previous
        : { top, bottom }
    );
  };
  // Re-measure when filtering changes how many branches the list holds.
  useLayoutEffect(measure, [count]);
  // Open with the current branch in view, clear of the faded edges.
  useLayoutEffect(() => {
    const element = list.current;
    const active = element?.querySelector<HTMLElement>("[data-active]");
    if (!(element && active)) {
      return;
    }
    const top = active.offsetTop - element.offsetTop;
    if (top + active.offsetHeight > element.clientHeight) {
      element.scrollTop =
        top - (element.clientHeight - active.offsetHeight) / 2;
      measure();
    }
  }, []);
  return (
    <div
      className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_var(--fade-top),#000_calc(100%-var(--fade-bottom)),transparent)] py-1 [--fade-bottom:0px] [--fade-top:0px] data-[fade-bottom]:[--fade-bottom:1rem] data-[fade-top]:[--fade-top:1rem]"
      data-fade-bottom={edges.bottom || undefined}
      data-fade-top={edges.top || undefined}
      onScroll={measure}
      ref={list}
    >
      {children}
    </div>
  );
}
