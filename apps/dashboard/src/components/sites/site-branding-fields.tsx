"use client";

import {
  LinkSquare02Icon,
  Share08Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import { useTranslations } from "use-intl";

import { SiteAssetField } from "@/components/sites/site-asset-field";
import { SiteSeparateAssetRows } from "@/components/sites/site-separate-asset-rows";
import { SiteSettingsItem } from "@/components/sites/site-settings-item";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

export function SiteBrandingFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.branding");
  return (
    <>
      <SiteSeparateAssetRows
        dark={form.logoDark}
        description={t("logoHint")}
        id="site-logo"
        kind="logo"
        light={form.logoLight}
        onDarkChange={(value) => update("logoDark", value)}
        onLightChange={(value) => update("logoLight", value)}
        onSeparateChange={(value) => update("separateLogos", value)}
        placeholder="/logo/light.svg"
        separate={form.separateLogos}
        separateLabel={t("separateLogos")}
        title={t("logo")}
      />
      <SiteSettingsItem
        description={t("logoHrefHint")}
        icon={LinkSquare02Icon}
        errorPath="logo.href"
        title={t("logoHref")}
        value={
          <Input
            aria-label={t("logoHref")}
            autoComplete="off"
            className="w-full sm:w-80"
            onChange={(event) => update("logoHref", event.target.value)}
            placeholder="https://example.com"
            spellCheck={false}
            value={form.logoHref}
          />
        }
      />
      <SiteSeparateAssetRows
        dark={form.faviconDark}
        description={t("faviconHint")}
        id="site-favicon"
        kind="favicon"
        light={form.faviconLight}
        onDarkChange={(value) => update("faviconDark", value)}
        onLightChange={(value) => update("faviconLight", value)}
        onSeparateChange={(value) => update("separateFavicons", value)}
        placeholder="/favicon.svg"
        separate={form.separateFavicons}
        separateLabel={t("separateFavicons")}
        title={t("favicon")}
      />
      <SiteSettingsItem
        description={t("shareImageHint")}
        icon={Share08Icon}
        errorPath="seo.image"
        title={t("shareImage")}
        value={
          <SiteAssetField
            id="site-share-image"
            kind="share"
            label={t("shareImage")}
            onChange={(value) => update("shareImage", value)}
            placeholder="/images/share.png"
            value={form.shareImage}
          />
        }
      />
      {form.shareImage.trim() ? (
        <SiteSettingsItem
          description={t("shareImageAltHint")}
          icon={TextIcon}
          errorPath="seo.imageAlt"
          title={t("shareImageAlt")}
          value={
            <Input
              aria-label={t("shareImageAlt")}
              autoComplete="off"
              className="w-full sm:w-80"
              maxLength={200}
              onChange={(event) => update("shareImageAlt", event.target.value)}
              placeholder={t("shareImageAltPlaceholder")}
              value={form.shareImageAlt}
            />
          }
        />
      ) : null}
    </>
  );
}
