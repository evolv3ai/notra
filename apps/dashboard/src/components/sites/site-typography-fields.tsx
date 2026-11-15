"use client";

import { useTranslations } from "use-intl";

import { SiteFontRows } from "@/components/sites/site-font-rows";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

export function SiteTypographyFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.typography");
  if (form.typographyMode === "single") {
    return (
      <SiteFontRows
        hint={t("fontHint")}
        id="site-font"
        label={t("font")}
        onChange={(value) => update("font", value)}
        value={form.font}
        weightHint={t("fontWeightHint")}
        weightLabel={t("fontWeight")}
      />
    );
  }
  return (
    <>
      <SiteFontRows
        hint={t("headingHint")}
        id="site-heading-font"
        label={t("heading")}
        onChange={(value) => update("heading", value)}
        value={form.heading}
        weightHint={t("headingWeightHint")}
        weightLabel={t("headingWeight")}
        weightNeedsFamily
      />
      <SiteFontRows
        hint={t("bodyHint")}
        id="site-body-font"
        label={t("body")}
        onChange={(value) => update("body", value)}
        value={form.body}
        weightHint={t("bodyWeightHint")}
        weightLabel={t("bodyWeight")}
        weightNeedsFamily
      />
    </>
  );
}
