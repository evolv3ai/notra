"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import { useUpdateSiteSettings } from "@/lib/hooks/use-update-site-settings";
import type {
  SiteSettingsEditorFooterProps,
  SiteSettingsEditorProps,
} from "@/types/components/site-settings";
import type { SiteSettingsForm } from "@/types/sites";
import {
  siteSettingsFormFromSite,
  siteSettingsPatch,
} from "@/utils/site-settings";

function SiteSettingsEditorFooter({
  canSave,
  isSaving,
  onCancel,
}: SiteSettingsEditorFooterProps) {
  const tCommon = useTranslations("common");
  return (
    <div className="flex justify-end gap-2">
      <Button
        disabled={isSaving}
        onClick={onCancel}
        size="sm"
        type="button"
        variant="ghost"
      >
        {tCommon("actions.cancel")}
      </Button>
      <Button disabled={!canSave} loading={isSaving} size="sm" type="submit">
        {tCommon("actions.save")}
      </Button>
    </div>
  );
}

export function SiteSettingsEditor({
  onDone,
  isValid,
  children,
}: SiteSettingsEditorProps) {
  const { site } = useSite().detail;
  const [base] = useState(site);
  const [form, setForm] = useState<SiteSettingsForm>(() =>
    siteSettingsFormFromSite(base)
  );
  const save = useUpdateSiteSettings({ onSaved: onDone });
  const patch = siteSettingsPatch(form, base);
  const canSave =
    Object.keys(patch).length > 0 &&
    (isValid?.(form) ?? true) &&
    !save.isPending;

  return (
    <form
      className="space-y-4"
      action={() => {
        if (canSave) {
          save.mutate(patch);
        }
      }}
    >
      <fieldset className="max-w-xl space-y-4" disabled={save.isPending}>
        {children(form, (key, value) =>
          setForm((current) => ({ ...current, [key]: value }))
        )}
      </fieldset>
      <SiteSettingsEditorFooter
        canSave={canSave}
        isSaving={save.isPending}
        onCancel={onDone}
      />
    </form>
  );
}
