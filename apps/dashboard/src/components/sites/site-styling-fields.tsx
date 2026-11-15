"use client";

import {
  ColorsIcon,
  ContrastIcon,
  GridIcon,
  Moon02Icon,
  PaintBrush01Icon,
  SourceCodeIcon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { useTranslations } from "use-intl";

import { SiteColorInput } from "@/components/sites/site-color-input";
import {
  SiteCodeModePreview,
  SiteDecorationPreview,
} from "@/components/sites/site-design-preview";
import { SiteOptionSelect } from "@/components/sites/site-option-select";
import { SiteSeparateAssetRows } from "@/components/sites/site-separate-asset-rows";
import {
  SiteSettingsItem,
  SiteSettingsList,
  SiteSettingsSwitchItem,
} from "@/components/sites/site-settings-item";
import {
  SITE_APPEARANCE_MODES,
  SITE_BACKGROUND_DECORATIONS,
  SITE_CODE_THEME_MODES,
  SITE_CODE_THEMES,
} from "@/constants/site-design";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

const CODE_THEME_OPTIONS = SITE_CODE_THEMES.map((theme) => ({
  value: theme as string,
  label: theme,
}));

export function SiteStylingFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.styling");
  const tModes = useTranslations("sites.design.appearances");
  const previewColors = {
    primary: form.primary,
    backgroundLight: form.backgroundLight,
    backgroundDark: form.backgroundDark,
  };
  return (
    <div className="space-y-4">
      <SiteSettingsList>
        <SiteSettingsItem
          description={t("primaryHint")}
          icon={PaintBrush01Icon}
          errorPath="colors.primary"
          title={t("primary")}
          value={
            <SiteColorInput
              id="site-color-primary"
              label={t("primary")}
              onChange={(value) => update("primary", value)}
              value={form.primary}
            />
          }
        />
        <SiteSettingsItem
          description={t("lightColorHint")}
          icon={Moon02Icon}
          errorPath="colors.light"
          title={t("lightColor")}
          value={
            <SiteColorInput
              fallback={form.primary}
              id="site-color-light"
              label={t("lightColor")}
              onChange={(value) => update("darkModeAccent", value)}
              placeholder={t("sameAsPrimary")}
              value={form.darkModeAccent}
            />
          }
        />
        <SiteSettingsItem
          description={t("darkColorHint")}
          icon={ColorsIcon}
          errorPath="colors.dark"
          title={t("darkColor")}
          value={
            <SiteColorInput
              fallback={form.primary}
              id="site-color-dark"
              label={t("darkColor")}
              onChange={(value) => update("button", value)}
              placeholder={t("sameAsPrimary")}
              value={form.button}
            />
          }
        />
      </SiteSettingsList>

      <SiteSettingsList>
        <SiteSettingsItem
          description={t("backgroundLightHint")}
          icon={Sun03Icon}
          errorPath="background.color.light"
          title={t("backgroundLight")}
          value={
            <SiteColorInput
              fallback="#FFFFFF"
              id="site-background-light"
              label={t("backgroundLight")}
              onChange={(value) => update("backgroundLight", value)}
              placeholder="#FFFFFF"
              value={form.backgroundLight}
            />
          }
        />
        <SiteSettingsItem
          description={t("backgroundDarkHint")}
          icon={Moon02Icon}
          errorPath="background.color.dark"
          title={t("backgroundDark")}
          value={
            <SiteColorInput
              fallback="#09090B"
              id="site-background-dark"
              label={t("backgroundDark")}
              onChange={(value) => update("backgroundDark", value)}
              placeholder="#09090B"
              value={form.backgroundDark}
            />
          }
        />
        <SiteSeparateAssetRows
          dark={form.backgroundImageDark}
          description={t("backgroundImageHint")}
          id="site-background-image"
          kind="background"
          light={form.backgroundImageLight}
          onDarkChange={(value) => update("backgroundImageDark", value)}
          onLightChange={(value) => update("backgroundImageLight", value)}
          onSeparateChange={(value) =>
            update("separateBackgroundImages", value)
          }
          placeholder="/images/background.png"
          separate={form.separateBackgroundImages}
          separateLabel={t("separateBackgroundImages")}
          title={t("backgroundImage")}
        />
        <SiteSettingsItem
          description={t("decorationHint")}
          icon={GridIcon}
          title={t("decoration")}
          value={
            <SiteOptionSelect
              describe={(value) => t(`previews.decorations.${value}`)}
              label={t("decoration")}
              onChange={(value) => update("decoration", value)}
              options={SITE_BACKGROUND_DECORATIONS.map((value) => ({
                value,
                label: t(`decorations.${value}`),
              }))}
              preview={(value) =>
                value === "none" ? null : (
                  <SiteDecorationPreview
                    colors={previewColors}
                    decoration={value}
                  />
                )
              }
              value={form.decoration}
            />
          }
        />
      </SiteSettingsList>

      <SiteSettingsList>
        <SiteSettingsItem
          description={t("appearanceHint")}
          icon={ContrastIcon}
          title={t("appearance")}
          value={
            <SiteOptionSelect
              label={t("appearance")}
              onChange={(value) => update("appearance", value)}
              options={SITE_APPEARANCE_MODES.map((value) => ({
                value,
                label: tModes(value),
              }))}
              value={form.appearance}
            />
          }
        />
        <SiteSettingsSwitchItem
          checked={form.showModeToggle}
          description={t("modeToggleHint")}
          icon={Sun03Icon}
          onCheckedChange={(checked) => update("showModeToggle", checked)}
          title={t("modeToggle")}
        />
        <SiteSettingsItem
          description={t("codeModeHint")}
          icon={SourceCodeIcon}
          title={t("codeMode")}
          value={
            <SiteOptionSelect
              describe={(value) => t(`previews.codeModes.${value}`)}
              label={t("codeMode")}
              onChange={(value) => update("codeMode", value)}
              options={SITE_CODE_THEME_MODES.map((value) => ({
                value,
                label: t(`codeModes.${value}`),
              }))}
              preview={(value) => (
                <SiteCodeModePreview codeMode={value} colors={previewColors} />
              )}
              value={form.codeMode}
            />
          }
        />
        {form.codeMode === "custom" ? (
          <>
            <SiteSettingsItem
              icon={Sun03Icon}
              errorPath="styling.codeblocks.light"
              title={t("codeLight")}
              value={
                <SiteOptionSelect
                  label={t("codeLight")}
                  onChange={(value) => update("codeLight", value)}
                  options={CODE_THEME_OPTIONS}
                  value={form.codeLight}
                />
              }
            />
            <SiteSettingsItem
              icon={Moon02Icon}
              errorPath="styling.codeblocks.dark"
              title={t("codeDark")}
              value={
                <SiteOptionSelect
                  label={t("codeDark")}
                  onChange={(value) => update("codeDark", value)}
                  options={CODE_THEME_OPTIONS}
                  value={form.codeDark}
                />
              }
            />
          </>
        ) : null}
      </SiteSettingsList>
    </div>
  );
}
