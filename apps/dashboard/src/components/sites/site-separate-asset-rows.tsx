"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "use-intl";

import { SiteAssetField } from "@/components/sites/site-asset-field";
import {
  SiteSettingsItem,
  SiteSettingsSwitchItem,
} from "@/components/sites/site-settings-item";
import type { SiteSeparateAssetRowsProps } from "@/types/site-design";

/** One image for both modes, or a light and a dark one when split. */
export function SiteSeparateAssetRows({
  id,
  kind,
  title,
  description,
  separateLabel,
  separate,
  onSeparateChange,
  light,
  dark,
  onLightChange,
  onDarkChange,
  placeholder,
}: SiteSeparateAssetRowsProps) {
  const t = useTranslations("sites.design");
  return (
    <>
      <SiteSettingsItem
        errorPath={kind === "background" ? "background.image" : kind}
        description={description}
        icon={Sun03Icon}
        title={separate ? t("lightMode", { title }) : title}
        value={
          <SiteAssetField
            id={`${id}-light`}
            kind={kind}
            label={title}
            onChange={onLightChange}
            placeholder={placeholder}
            value={light}
          />
        }
      />
      {separate ? (
        <SiteSettingsItem
          icon={Moon02Icon}
          title={t("darkMode", { title })}
          value={
            <SiteAssetField
              id={`${id}-dark`}
              kind={kind}
              label={t("darkMode", { title })}
              onChange={onDarkChange}
              placeholder={placeholder}
              value={dark}
            />
          }
        />
      ) : null}
      <SiteSettingsSwitchItem
        checked={separate}
        icon={Moon02Icon}
        onCheckedChange={onSeparateChange}
        title={separateLabel}
      />
    </>
  );
}
