"use client";

import { Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import { useTranslations } from "use-intl";

import { AutomationActionIcon } from "@/components/automation/action-icon";
import {
  EditorBox,
  EditorSection,
} from "@/components/automation/editor/editor-parts";
import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import type {
  GeoAlertDestinationRowProps,
  GeoAlertDestinationsProps,
} from "@/types/automation/geo-alerts";

export function GeoAlertDestinationsSection({
  actions,
  destinations,
  onToggle,
  organizationSlug,
  loadFailed,
  onRetry,
  retrying,
}: GeoAlertDestinationsProps) {
  const t = useTranslations("automation.alerts");
  const tCommon = useTranslations("common");
  const { openSettings } = useSettingsModal();
  const slackBlocked = !destinations?.slackConnected;
  const webhookBlocked = !destinations?.webhookEndpointCount;

  if (loadFailed) {
    return (
      <EditorSection hint={t("dialog.sendToHint")} label={t("dialog.sendTo")}>
        <EditorBox>
          <div
            className="flex min-h-12 items-center gap-3 px-4 py-3"
            role="alert"
          >
            <HugeiconsIcon
              className="text-destructive size-4 shrink-0"
              icon={Alert02Icon}
            />
            <p className="text-muted-foreground min-w-0 flex-1 text-sm">
              {t("dialog.destinationsFailed")}
            </p>
            <Button
              loading={retrying}
              onClick={onRetry}
              size="sm"
              type="button"
              variant="outline"
            >
              <HugeiconsIcon className="size-3.5" icon={RefreshIcon} />
              {tCommon("actions.tryAgain")}
            </Button>
          </div>
        </EditorBox>
      </EditorSection>
    );
  }

  return (
    <EditorSection hint={t("dialog.sendToHint")} label={t("dialog.sendTo")}>
      <EditorBox>
        <DestinationRow
          checked={actions.slack}
          disabled={slackBlocked}
          hint={
            slackBlocked ? (
              <>
                {t("dialog.slackMissing")}{" "}
                <Link
                  className="text-foreground underline underline-offset-2"
                  href={`/${organizationSlug}/integrations/slack`}
                >
                  {t("dialog.connectSlack")}
                </Link>
              </>
            ) : (
              t("dialog.slackHint")
            )
          }
          icon={<AutomationActionIcon kind="slack" />}
          id="alert-slack"
          label="Slack"
          onCheckedChange={(value) => onToggle("slack", value)}
        />
        <DestinationRow
          checked={actions.email}
          hint={t("dialog.emailHint", { count: destinations?.ownerCount ?? 1 })}
          icon={<AutomationActionIcon kind="email" />}
          id="alert-email"
          label={tCommon("labels.email")}
          onCheckedChange={(value) => onToggle("email", value)}
        />
        <DestinationRow
          checked={actions.webhook}
          disabled={webhookBlocked}
          hint={
            <>
              {webhookBlocked
                ? t("dialog.webhookMissing")
                : t("dialog.webhookHint", {
                    count: destinations?.webhookEndpointCount ?? 0,
                  })}{" "}
              <button
                className="text-foreground underline underline-offset-2"
                onClick={() => openSettings("webhooks")}
                type="button"
              >
                {webhookBlocked
                  ? t("dialog.addEndpoint")
                  : t("dialog.manageWebhooks")}
              </button>
            </>
          }
          icon={<AutomationActionIcon kind="webhook" />}
          id="alert-webhook"
          label={t("dialog.webhook")}
          onCheckedChange={(value) => onToggle("webhook", value)}
        />
      </EditorBox>
    </EditorSection>
  );
}

export function DestinationRow({
  checked,
  disabled,
  hint,
  icon,
  id,
  label,
  onCheckedChange,
}: GeoAlertDestinationRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <Label className="text-sm font-medium" htmlFor={id}>
          {label}
        </Label>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
