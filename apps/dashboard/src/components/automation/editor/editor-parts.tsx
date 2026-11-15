"use client";

import {
  Add01Icon,
  AiBrowserIcon,
  ArrowDown01Icon,
  Clock01Icon,
  GithubIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@notra/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import { Switch } from "@notra/ui/components/ui/switch";
import { cn } from "@notra/ui/lib/utils";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";

export type AutomationFormKind = "alert" | "schedule" | "event";

const KIND_ICONS: Record<AutomationFormKind, IconSvgElement> = {
  alert: AiBrowserIcon,
  schedule: Clock01Icon,
  event: GithubIcon,
};

/** Titled group, like the site settings: heading with a short hint, then a box. */
export function EditorSection({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
        <h2 className="text-sm font-medium">{label}</h2>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Rows separated by hairlines inside the dualtone shell. */
export function EditorBox({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className="border-shell-border bg-shell rounded-2xl border p-0.5">
      <div
        className={cn(
          "divide-table-row-border shadow-table-card bg-table-card border-table-card-border divide-y overflow-hidden rounded-[14px] border",
          className
        )}
        {...props}
      />
    </div>
  );
}

/** Free-form content (cards, fields) inside a box. */
export function EditorPad({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-4 p-4", className)} {...props} />;
}

export function EditorHeader({
  name,
  onNameChange,
  placeholder,
  maxLength,
  title,
  enabled,
  onEnabledChange,
  kind,
  children,
}: {
  /** Editable name; omit for automations that are titled automatically. */
  name?: string;
  onNameChange?: (name: string) => void;
  placeholder?: string;
  maxLength?: number;
  title?: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  kind: AutomationFormKind;
  children?: ReactNode;
}) {
  const t = useTranslations("automation.editor");
  const tMenu = useTranslations("automation.page.createMenu");
  return (
    <div className="space-y-3">
      {onNameChange ? (
        <input
          aria-label={t("name")}
          className="placeholder:text-muted-foreground/60 w-full bg-transparent px-1 text-2xl font-bold tracking-tight outline-none @min-[40rem]/main:text-3xl"
          maxLength={maxLength}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={placeholder}
          value={name ?? ""}
        />
      ) : (
        <PageHeading className="px-1" title={title} />
      )}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
          {enabled ? t("active") : t("inactive")}
        </label>
        <span aria-hidden="true" className="bg-border h-4 w-px" />
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon className="size-4" icon={KIND_ICONS[kind]} />
          {tMenu(kind)}
        </span>
        {children}
      </div>
    </div>
  );
}

/** Action bar at the end of the editor page. */
export function EditorFooter({
  start,
  status,
  children,
}: {
  /** Secondary action on the left, e.g. "Send test". */
  start?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {start}
        <div className="min-w-0 text-xs">{status}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** "+ Add …" row that opens a searchable list, like the trigger picker. */
export function TriggerKindPicker({
  kind,
  onSelect,
}: {
  kind: AutomationFormKind;
  onSelect: (kind: AutomationFormKind) => void;
}) {
  const t = useTranslations("automation.editor");
  const tMenu = useTranslations("automation.page.createMenu");
  const [open, setOpen] = useState(false);
  const groups: { heading: string; kinds: AutomationFormKind[] }[] = [
    { heading: t("groups.geo"), kinds: ["alert"] },
    { heading: t("groups.content"), kinds: ["schedule", "event"] },
  ];

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground duration-fast focus-visible:bg-muted/50 flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors outline-none"
        type="button"
      >
        <HugeiconsIcon className="size-4" icon={Add01Icon} />
        {t("changeTrigger")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-0 shadow-none">
        <Command>
          <CommandInput placeholder={t("searchTriggers")} />
          <CommandList>
            <CommandEmpty>{t("noTriggers")}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup heading={group.heading} key={group.heading}>
                {group.kinds.map((item) => (
                  <CommandItem
                    className="gap-2.5 py-2"
                    data-checked={kind === item}
                    key={item}
                    keywords={[tMenu(`${item}Hint`)]}
                    onSelect={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    value={tMenu(item)}
                  >
                    <HugeiconsIcon
                      className="text-muted-foreground size-4"
                      icon={KIND_ICONS[item]}
                    />
                    {tMenu(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Outlined like an input, so chips stay visible on the card in both themes. */
export const PICKER_CHIP_CLASS =
  "border-input bg-background hover:bg-muted dark:bg-input/30 dark:hover:bg-input/60 duration-fast focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-[3px]";

export interface PickerOption {
  value: string;
  label: string;
  icon?: IconSvgElement;
}

/** A muted chip that opens a short list, instead of a native-looking select. */
export function PickerSelect({
  value,
  onChange,
  options,
  ariaLabel,
  searchPlaceholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  ariaLabel: string;
  /** Adds a search field; worth it once the list gets long. */
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <button
            aria-label={
              selected ? `${ariaLabel}: ${selected.label}` : ariaLabel
            }
            className={PICKER_CHIP_CLASS}
            type="button"
          />
        }
      >
        {selected?.icon ? (
          <HugeiconsIcon
            className="text-muted-foreground size-4"
            icon={selected.icon}
          />
        ) : null}
        <span className="truncate">{selected?.label}</span>
        <HugeiconsIcon
          className="text-muted-foreground size-3.5"
          icon={ArrowDown01Icon}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-0 shadow-none">
        <Command>
          {searchPlaceholder ? (
            <CommandInput placeholder={searchPlaceholder} />
          ) : null}
          <CommandList>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  className="gap-2.5 py-2"
                  data-checked={option.value === value}
                  key={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  value={option.label}
                >
                  {option.icon ? (
                    <HugeiconsIcon
                      className="text-muted-foreground size-4"
                      icon={option.icon}
                    />
                  ) : null}
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
