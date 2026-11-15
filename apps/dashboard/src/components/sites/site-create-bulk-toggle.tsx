"use client";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import { Switch } from "@notra/ui/components/ui/switch";
import { m } from "motion/react";
import { useTranslations } from "use-intl";

import { SITE_CREATE_ROW_VARIANTS } from "@/constants/site-create";
import type { SiteCreateBulkToggleProps } from "@/types/components/sites";

export function SiteCreateBulkToggle({
  id,
  count,
  checked,
  disabled,
  onCheckedChange,
}: SiteCreateBulkToggleProps) {
  const t = useTranslations("sites.new.bulk");
  return (
    <m.div
      className="bg-muted/40 rounded-xl border px-4 py-3"
      variants={SITE_CREATE_ROW_VARIANTS}
    >
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={id}>{t("toggle", { count })}</FieldLabel>
          <FieldDescription>{t("toggleHint", { count })}</FieldDescription>
        </FieldContent>
        <Switch
          checked={checked}
          disabled={disabled}
          id={id}
          onCheckedChange={onCheckedChange}
        />
      </Field>
    </m.div>
  );
}
