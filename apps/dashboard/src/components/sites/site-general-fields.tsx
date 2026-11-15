"use client";

import { Tag01Icon, TextAlignLeftIcon } from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useTranslations } from "use-intl";

import { SiteSettingsItem } from "@/components/sites/site-settings-item";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

export function SiteGeneralFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.general");
  return (
    <>
      <SiteSettingsItem
        description={t("nameHint")}
        icon={Tag01Icon}
        errorPath="name"
        title={t("name")}
        value={
          <Input
            aria-label={t("name")}
            autoComplete="off"
            className="w-full"
            maxLength={80}
            onChange={(event) => update("name", event.target.value)}
            value={form.name}
          />
        }
      />
      <SiteSettingsItem
        description={t("descriptionHint")}
        icon={TextAlignLeftIcon}
        errorPath="description"
        title={t("description")}
        value={
          <Textarea
            aria-label={t("description")}
            maxLength={300}
            onChange={(event) => update("description", event.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={3}
            value={form.description}
          />
        }
      />
    </>
  );
}
