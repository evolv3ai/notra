"use client";

import {
  AiBrowserIcon,
  ArrowRight02Icon,
  Clock01Icon,
  GithubIcon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { cn } from "@notra/ui/lib/utils";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { AutomationActionIcon } from "@/components/automation/action-icon";
import Link from "@/components/framework/link";
import type {
  AutomationActionKind,
  AutomationTemplate,
  AutomationTemplateTone,
  AutomationTriggerKind,
} from "@/types/automation/automations";
import type { GeoAlertAutomation } from "@/types/automation/geo-alerts";

const TRIGGER_ICONS: Record<AutomationTriggerKind, IconSvgElement> = {
  schedule: Clock01Icon,
  github: GithubIcon,
  geo: AiBrowserIcon,
  event: ZapIcon,
};

const TONE_CLASSES: Record<AutomationTemplateTone, string> = {
  destructive: "text-destructive",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
};

interface AutomationTemplateGridProps {
  templates: readonly AutomationTemplate[];
  organizationSlug: string;
  /** `undefined` until the alert list loaded; alert templates wait for it. */
  alerts: GeoAlertAutomation[] | undefined;
  onOpenWebhooks: () => void;
}

/** Where a template leads: its editor, or the existing alert it is already running as. */
function templateHref(
  organizationSlug: string,
  template: AutomationTemplate,
  existingAlert: GeoAlertAutomation | undefined
) {
  if (template.kind === "webhooks") {
    return null;
  }
  if (existingAlert) {
    return `/${organizationSlug}/automation/${existingAlert.id}`;
  }
  return `/${organizationSlug}/automation/new?template=${template.id}`;
}

export function AutomationTemplateGrid({
  templates,
  organizationSlug,
  alerts,
  onOpenWebhooks,
}: AutomationTemplateGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => {
        const sameSignal =
          template.kind === "alert"
            ? (alerts ?? []).filter(
                (alert) => alert.sourceConfig.signal === template.signal
              )
            : [];
        const existing =
          sameSignal.find((alert) => alert.enabled) ?? sameSignal[0];
        return (
          <AutomationTemplateCard
            active={existing?.enabled === true}
            disabled={template.kind === "alert" && !alerts}
            href={templateHref(organizationSlug, template, existing)}
            key={template.id}
            onSelect={onOpenWebhooks}
            template={template}
          />
        );
      })}
    </div>
  );
}

function AutomationTemplateCard({
  template,
  href,
  active,
  disabled,
  onSelect,
}: {
  template: AutomationTemplate;
  href: string | null;
  active: boolean;
  /** Not clickable yet, e.g. while it is unknown whether the alert exists. */
  disabled: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("automation.templates");
  return (
    <AutomationCard
      action={template.action}
      description={t(`items.${template.id}.description`)}
      disabled={disabled}
      href={href ?? undefined}
      icon={template.icon}
      onSelect={href ? undefined : onSelect}
      status={
        active ? (
          <StatusBadge
            appearance={{ variant: "success" }}
            label={t("active")}
          />
        ) : null
      }
      title={t(`items.${template.id}.title`)}
      tone={template.tone}
      trigger={template.trigger}
    />
  );
}

/**
 * The card behind templates and agent suggestions: icon, title and
 * description on the inner panel, "trigger → action" underneath. `corner`
 * sits top right outside the clickable area, for controls like dismiss.
 */
export function AutomationCard({
  icon,
  tone,
  title,
  description,
  trigger,
  action,
  status,
  corner,
  href,
  onSelect,
  disabled = false,
  label,
}: {
  icon: IconSvgElement;
  tone: AutomationTemplateTone;
  title: string;
  description: string | null;
  trigger: AutomationTriggerKind;
  action: AutomationActionKind;
  status?: ReactNode;
  corner?: ReactNode;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Accessible name when the visible title is not enough. */
  label?: string;
}) {
  const t = useTranslations("automation.templates");
  const className =
    "group/card border-shell-border bg-shell focus-visible:ring-ring/50 flex h-full flex-col rounded-2xl border px-0.5 pt-0.5 text-left outline-none focus-visible:ring-[3px]";
  const content = (
    <>
      <div className="border-table-card-border bg-table-card shadow-table-card group-hover/card:bg-muted/30 duration-fast flex flex-1 flex-col gap-3 rounded-[14px] border p-4 transition-colors">
        <span className="bg-background text-muted-foreground ring-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1">
          <HugeiconsIcon
            className={cn("size-4.5", TONE_CLASSES[tone])}
            icon={icon}
            strokeWidth={1.75}
          />
        </span>
        <div className="space-y-1">
          <h3 className="line-clamp-1 text-sm font-medium">{title}</h3>
          {description ? (
            <p className="text-muted-foreground line-clamp-2 text-sm text-pretty">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="text-muted-foreground flex min-h-9 items-center gap-2 px-3.5 py-2 text-xs">
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon className="size-3.5" icon={TRIGGER_ICONS[trigger]} />
          {t(`triggers.${trigger}`)}
        </span>
        <HugeiconsIcon className="size-3 opacity-60" icon={ArrowRight02Icon} />
        <span className="flex items-center gap-1.5">
          <AutomationActionIcon className="size-3.5" kind={action} />
          {t(`actions.${action}`)}
        </span>
        {status ? <span className="ml-auto">{status}</span> : null}
      </div>
    </>
  );

  let card: ReactNode;
  if (disabled) {
    card = (
      <div aria-disabled="true" className={className}>
        {content}
      </div>
    );
  } else if (href) {
    card = (
      <Link aria-label={label} className={className} href={href}>
        {content}
      </Link>
    );
  } else {
    card = (
      <button
        aria-label={label}
        className={cn(className, "cursor-pointer")}
        onClick={onSelect}
        type="button"
      >
        {content}
      </button>
    );
  }

  return corner ? (
    <div className="relative h-full">
      {card}
      <div className="absolute top-3 right-3">{corner}</div>
    </div>
  ) : (
    card
  );
}
