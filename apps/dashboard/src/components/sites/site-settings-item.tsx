"use client";

import {
  ArrowRight01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { Switch } from "@notra/ui/components/ui/switch";
import { useId } from "react";

import { SiteDesignError } from "@/components/sites/site-design-error";
import { SITE_SETTINGS_PANEL_CLASSNAME } from "@/constants/sites";
import { cn } from "@/lib/utils";
import type {
  SiteSettingsBlockProps,
  SiteSettingsGroupProps,
  SiteSettingsHintProps,
  SiteSettingsIconTileProps,
  SiteSettingsItemTextProps,
  SiteSettingsItemProps,
  SiteSettingsListProps,
  SiteSettingsSwitchItemProps,
  SiteSettingsValueProps,
} from "@/types/components/site-settings";

function IconTile({ icon }: SiteSettingsIconTileProps) {
  return (
    <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
      <HugeiconsIcon
        aria-hidden="true"
        className="size-4.5"
        icon={icon}
        strokeWidth={1.75}
      />
    </span>
  );
}

function ItemText({ title, description, value }: SiteSettingsItemTextProps) {
  return (
    <span className="min-w-0 flex-1 space-y-0.5">
      <span className="block text-sm font-medium">{title}</span>
      {description ? (
        <span className="text-muted-foreground block max-w-2xl text-sm text-pretty">
          {description}
        </span>
      ) : null}
      {value ? <span className="flex pt-2 sm:hidden">{value}</span> : null}
    </span>
  );
}

export function SiteSettingsValue({ children, mono }: SiteSettingsValueProps) {
  return (
    <span
      className={cn(
        "bg-background inline-flex h-8 max-w-full min-w-0 items-center truncate rounded-lg border px-3 text-sm sm:max-w-72",
        mono && "font-mono text-xs"
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function SiteSettingsList({ children }: SiteSettingsListProps) {
  return (
    <div className="border-shell-border bg-shell w-full rounded-2xl border p-0.5">
      <div className="border-table-card-border bg-table-card shadow-table-card overflow-hidden rounded-[14px] border [&>*:last-child]:border-b-0">
        {children}
      </div>
    </div>
  );
}

export function SiteSettingsGroup({
  icon,
  title,
  action,
  children,
}: SiteSettingsGroupProps) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground size-4"
            icon={icon}
            strokeWidth={1.5}
          />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A row whose control spans the full width below the text, e.g. a list. */
export function SiteSettingsBlock({
  errorPath,
  icon,
  title,
  description,
  children,
}: SiteSettingsBlockProps) {
  return (
    <div className="space-y-4 border-b px-4 py-4 sm:px-5">
      <div className="flex items-center gap-4">
        <IconTile icon={icon} />
        <ItemText description={description} title={title} />
      </div>
      <div className="sm:pl-9">
        {children}
        <SiteDesignError path={errorPath} />
      </div>
    </div>
  );
}

export function SiteSettingsItem({
  errorPath,
  icon,
  title,
  description,
  value,
  children,
  open,
  onOpenChange,
}: SiteSettingsItemProps) {
  if (!children) {
    return (
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b px-4 py-4 sm:grid-cols-[1.25rem_minmax(0,1fr)_15rem] sm:px-5">
        <IconTile icon={icon} />
        <ItemText description={description} title={title} />
        <div className="col-start-2 flex min-w-0 flex-col items-end sm:col-start-auto [&>*]:w-full [&>[data-slot=switch]]:w-8">
          {value}
          <SiteDesignError path={errorPath} />
        </div>
      </div>
    );
  }
  return (
    <Collapsible className="border-b" onOpenChange={onOpenChange} open={open}>
      <CollapsibleTrigger
        render={
          <button
            className="group/item hover:bg-muted/40 focus-visible:bg-muted/40 data-[panel-open]:bg-muted/30 flex w-full items-center gap-4 px-4 py-4 text-left transition-colors outline-none sm:px-5"
            type="button"
          />
        }
      >
        <IconTile icon={icon} />
        <ItemText description={description} title={title} value={value} />
        {value ? <span className="hidden sm:flex">{value}</span> : null}
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/item:rotate-90 motion-reduce:transition-none"
          icon={ArrowRight01Icon}
          strokeWidth={2}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className={SITE_SETTINGS_PANEL_CLASSNAME}>
        <div className="border-t px-4 py-5 sm:px-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SiteSettingsSwitchItem({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  action,
}: SiteSettingsSwitchItemProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b px-4 py-4 sm:grid-cols-[1.25rem_minmax(0,1fr)_15rem] sm:px-5">
      <IconTile icon={icon} />
      <label className="min-w-0 flex-1" htmlFor={id}>
        <ItemText description={description} title={title} />
      </label>
      <div className="col-start-2 flex items-center justify-end gap-3 sm:col-start-auto">
        {action}
        <Switch
          checked={checked}
          disabled={disabled}
          id={id}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  );
}

export function SiteSettingsHint({ children }: SiteSettingsHintProps) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm text-pretty">
      <HugeiconsIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
        icon={InformationCircleIcon}
        strokeWidth={1.75}
      />
      <span>{children}</span>
    </p>
  );
}
