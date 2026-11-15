"use client";

import {
  Alert02Icon,
  Cancel01Icon,
  Megaphone01Icon,
  Moon02Icon,
  Sun03Icon,
  TextAlignLeftIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { SiteColorInput } from "@/components/sites/site-color-input";
import { SiteOptionSelect } from "@/components/sites/site-option-select";
import {
  SiteSettingsBlock,
  SiteSettingsItem,
  SiteSettingsSwitchItem,
} from "@/components/sites/site-settings-item";
import { SITE_BANNER_TYPES } from "@/constants/site-design";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";
import { bannerPresetColors } from "@/utils/site-design";

const code = (chunks: ReactNode) => (
  <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
    {chunks}
  </code>
);

export function SiteBannerFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.banner");
  const preset = bannerPresetColors(form);
  const light = form.bannerLight || preset.light;
  return (
    <>
      <SiteSettingsSwitchItem
        checked={form.bannerEnabled}
        description={t("enabledHint")}
        icon={Megaphone01Icon}
        onCheckedChange={(checked) => update("bannerEnabled", checked)}
        title={t("enabled")}
      />
      {form.bannerEnabled ? (
        <>
          <SiteSettingsBlock
            description={t("contentHint")}
            errorPath="banner.content"
            icon={TextAlignLeftIcon}
            title={t("content")}
          >
            <Input
              aria-label={t("content")}
              autoComplete="off"
              className="w-full"
              maxLength={300}
              onChange={(event) => update("bannerContent", event.target.value)}
              placeholder={t("contentPlaceholder")}
              value={form.bannerContent}
            />
          </SiteSettingsBlock>
          <SiteSettingsSwitchItem
            checked={form.bannerDismissible}
            description={t("dismissibleHint")}
            icon={Cancel01Icon}
            onCheckedChange={(checked) => update("bannerDismissible", checked)}
            title={t("dismissible")}
          />
          <SiteSettingsItem
            description={t.rich("typeHint", { code })}
            errorPath="banner.type"
            icon={Alert02Icon}
            title={t("type")}
            value={
              <SiteOptionSelect
                label={t("type")}
                onChange={(value) => update("bannerType", value)}
                options={SITE_BANNER_TYPES.map((value) => ({
                  value,
                  label: t(`types.${value}`),
                }))}
                value={form.bannerType}
              />
            }
          />
          <SiteSettingsItem
            description={t("lightColorHint")}
            errorPath="banner.color"
            icon={Sun03Icon}
            title={t("lightColor")}
            value={
              <SiteColorInput
                fallback={preset.light}
                id="site-banner-light"
                label={t("lightColor")}
                onChange={(value) => update("bannerLight", value)}
                placeholder={preset.light}
                value={form.bannerLight}
              />
            }
          />
          <SiteSettingsItem
            description={t("darkColorHint")}
            icon={Moon02Icon}
            title={t("darkColor")}
            value={
              <SiteColorInput
                fallback={form.bannerLight ? light : preset.dark}
                id="site-banner-dark"
                label={t("darkColor")}
                onChange={(value) => update("bannerDark", value)}
                placeholder={form.bannerLight ? t("sameAsLight") : preset.dark}
                value={form.bannerDark}
              />
            }
          />
        </>
      ) : null}
    </>
  );
}
