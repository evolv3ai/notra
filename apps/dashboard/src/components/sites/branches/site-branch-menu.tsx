"use client";

import {
  Add01Icon,
  GitBranchIcon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Input } from "@notra/ui/components/ui/input";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteBranchBadge } from "@/components/sites/branches/site-branch-badge";
import { SiteBranchEntries } from "@/components/sites/branches/site-branch-entries";
import type { SiteBranchMenuProps } from "@/types/site-branches";
import { siteBranchLabels } from "@/utils/site-branch-label";

export function SiteBranchMenu(props: SiteBranchMenuProps) {
  const t = useTranslations("sites.branches");
  const locale = useLocale();
  const deleted = props.entries.filter(
    (entry) => !entry.exists && entry.hasDraft
  );
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.open) {
      const frame = requestAnimationFrame(() => input.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [props.open]);
  return (
    <DropdownMenu open={props.open} onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger
        aria-label={t("current", { branch: props.current })}
        render={
          <Button
            variant="secondary"
            disabled={props.disabled}
            className="h-7 max-w-full min-w-0 justify-start gap-2 px-2.5 text-sm font-normal active:scale-100"
          />
        }
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground shrink-0"
          icon={GitBranchIcon}
          size={16}
        />
        <span
          className="max-w-52 min-w-0 truncate text-start"
          title={props.current}
        >
          {siteBranchLabels(
            [
              props.entries.find((entry) => entry.name === props.current) ?? {
                name: props.current,
              },
              ...props.entries.filter(
                (entry) => entry.exists && entry.name !== props.current
              ),
            ],
            locale,
            (date) => t("draftFrom", { date })
          ).get(props.current)}
        </span>
        <SiteBranchBadge
          live={props.current === props.productionBranch}
          pullRequest={props.pullRequest}
        />
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground shrink-0"
          icon={ArrowDown01Icon}
          size={14}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-88 max-w-[90vw]">
        <div className="p-1">
          <Input
            ref={input}
            aria-label={t("search")}
            placeholder={t("search")}
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape" && event.key !== "ArrowDown") {
                event.stopPropagation();
              }
            }}
          />
        </div>
        <SiteBranchEntries {...props} />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          closeOnClick={false}
          disabled={props.disabled}
          onClick={props.onStartCreate}
        >
          {props.creating ? (
            <Spinner />
          ) : (
            <HugeiconsIcon aria-hidden="true" icon={Add01Icon} size={16} />
          )}
          {t("create")}
        </DropdownMenuItem>
        {deleted.length > 0 ? (
          <div className="text-muted-foreground flex items-center gap-1 border-t px-2 py-2 text-xs">
            <span className="flex-1">
              {t("deletedDrafts", { count: deleted.length })}
            </span>
            <DropdownMenuItem
              className="min-h-7 px-1 text-xs underline underline-offset-2"
              onClick={() =>
                props.onAction({
                  kind: "discardDeleted",
                  branch: deleted[0]!.name,
                  branches: deleted.map((entry) => entry.name),
                })
              }
            >
              {t("discard")}
            </DropdownMenuItem>
          </div>
        ) : null}
        {props.actions ? (
          <>
            <DropdownMenuSeparator />
            {props.actions}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
