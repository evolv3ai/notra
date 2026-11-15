"use client";

import { PasswordValidationIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { SITE_PREVIEW_PASSWORD_MIN_LENGTH } from "@notra/sites-core/constants/sites";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import { SitePreviewPasswordField } from "@/components/sites/site-preview-password-field";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import { SiteSettingsItem } from "@/components/sites/site-settings-item";
import { SITE_PREVIEW_ACCESS_MODES } from "@/constants/site-preview-access";
import { useSavePreviewAccess } from "@/lib/hooks/use-save-preview-access";
import type { SitePreviewPasswordDialogProps } from "@/types/components/site-preview-access";
import type { SitePreviewAccessMode } from "@/types/site-preview-access";
import {
  sitePreviewAccessMode,
  sitePreviewAccessPlan,
} from "@/utils/site-preview-access";

/** Preview access as an inline select; only password and turning off ask first. */
export function SitePreviewAccessRows() {
  const t = useTranslations("sites.previewAccess");
  const tSettings = useTranslations("sites.settings");
  const { organizationId, siteId, detail } = useSite();
  const { site } = detail;
  const current = site.previewsEnabled ? sitePreviewAccessMode(site) : "off";
  const [dialog, setDialog] = useState<"password" | "off" | null>(null);
  const [target, setTarget] = useState<SitePreviewAccessMode | "off" | null>(
    null
  );
  const save = useSavePreviewAccess({
    organizationId,
    siteId,
    onSaved: () => setDialog(null),
  });
  const apply = (next: SitePreviewAccessMode | "off", password = "") => {
    setTarget(next);
    save.mutate(
      sitePreviewAccessPlan(site, {
        enabled: next !== "off",
        mode: next === "off" ? sitePreviewAccessMode(site) : next,
        password,
        editingPassword: password.length > 0,
      })
    );
  };
  const items = [
    ...SITE_PREVIEW_ACCESS_MODES.map((option) => ({
      value: option.mode,
      label: t(`trigger.${option.mode}`),
    })),
    { value: "off" as const, label: t("trigger.off") },
  ];
  const openCount = detail.previews.length;

  return (
    <>
      <SiteSettingsItem
        description={tSettings("previewsEnabledHint")}
        icon={ViewIcon}
        title={tSettings("previewBuilds")}
        value={
          <Select
            disabled={save.isPending}
            items={items}
            onValueChange={(value) => {
              const next = items.find((item) => item.value === value)?.value;
              if (!next || next === current) {
                return;
              }
              if (next === "password" && !site.previewPasswordSetAt) {
                setDialog("password");
              } else if (next === "off" && openCount > 0) {
                setDialog("off");
              } else {
                apply(next);
              }
            }}
            value={save.isPending && target ? target : current}
          >
            <SelectTrigger aria-label={t("whoLabel")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {current === "password" && site.previewPasswordSetAt ? (
        <SiteSettingsItem
          description={t.rich("passwordSet", {
            time: () =>
              site.previewPasswordSetAt ? (
                <SiteRelativeTime date={site.previewPasswordSetAt} inline />
              ) : null,
          })}
          icon={PasswordValidationIcon}
          title={t("passwordLabel")}
          value={
            <div className="flex justify-end">
              <Button
                onClick={() => setDialog("password")}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("changePassword")}
              </Button>
            </div>
          }
        />
      ) : null}
      <SitePreviewPasswordDialog
        onOpenChange={(open) => setDialog(open ? "password" : null)}
        onSubmit={(password) => apply("password", password)}
        open={dialog === "password"}
        passwordSetAt={site.previewPasswordSetAt}
        pending={save.isPending}
      />
      <ConfirmDialog
        confirmLabel={t("offConfirmAction")}
        description={t("offConfirmDescription", { count: openCount })}
        onConfirm={() => apply("off")}
        onOpenChange={(open) => setDialog(open ? "off" : null)}
        open={dialog === "off"}
        pending={save.isPending}
        title={t("offConfirmTitle")}
        variant="destructive"
      />
    </>
  );
}

function SitePreviewPasswordDialog({
  open,
  onOpenChange,
  passwordSetAt,
  pending,
  onSubmit,
}: SitePreviewPasswordDialogProps) {
  const t = useTranslations("sites.previewAccess");
  const tCommon = useTranslations("common");
  const id = useId();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Every close path (Cancel, Escape, a finished save) clears the old entry.
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setPassword("");
      setShowPassword(false);
    }
  }
  const tooShort = password.length < SITE_PREVIEW_PASSWORD_MIN_LENGTH;
  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {passwordSetAt ? t("changeDialogTitle") : t("setDialogTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("passwordDialogDescription")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          id={`${id}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            if (!tooShort && !pending) {
              onSubmit(password);
            }
          }}
        >
          <SitePreviewPasswordField
            editing
            idPrefix={id}
            onChange={setPassword}
            onEdit={() => undefined}
            onToggleShowPassword={() => setShowPassword((shown) => !shown)}
            passwordSetAt={passwordSetAt}
            showPassword={showPassword}
            tooShort={tooShort}
            value={password}
          />
        </form>
        <ResponsiveDialogFooter>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button
            disabled={tooShort}
            form={`${id}-form`}
            loading={pending}
            type="submit"
          >
            {t("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
