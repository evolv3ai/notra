"use client";

import {
  CheckmarkCircle02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteBannerFields } from "@/components/sites/site-banner-fields";
import { SiteBrandDialog } from "@/components/sites/site-brand-dialog";
import { SiteBrandingFields } from "@/components/sites/site-branding-fields";
import { SiteFooterFields } from "@/components/sites/site-footer-fields";
import { SiteGeneralFields } from "@/components/sites/site-general-fields";
import { SiteNavbarFields } from "@/components/sites/site-navbar-fields";
import { SiteSeoFields } from "@/components/sites/site-seo-fields";
import {
  SiteSettingsItem,
  SiteSettingsList,
} from "@/components/sites/site-settings-item";
import { SiteStylingFields } from "@/components/sites/site-styling-fields";
import { SiteTypographyFields } from "@/components/sites/site-typography-fields";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { useSiteBrandDefaults } from "@/lib/hooks/use-site-brand-defaults";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";
import type {
  SiteDesignAppearanceProps,
  SiteDesignBrandingProps,
} from "@/types/site-design-sections";
import {
  applyBrandToDesign,
  describeBrandForDesign,
  patchDesign,
  readBackDesignForm,
  readDesignForm,
} from "@/utils/site-design";

export function SiteDesignAppearance({ section }: SiteDesignAppearanceProps) {
  const state = useSiteWorkspace()!;
  const [form, setForm] = useState(() => readDesignForm(state.config));
  const [snapshot, setSnapshot] = useState(state.document);
  const [written, setWritten] = useState(state.config);
  const t = useTranslations("sites.design");
  if (snapshot !== state.document && !state.unsaved) {
    setSnapshot(state.document);
    setWritten(state.config);
    setForm(readBackDesignForm(state.config, form, written));
  }
  const change = (next: SiteDesignForm) => {
    if (state.readOnly) {
      return;
    }
    const config = patchDesign(state.config, next, form);
    state.update(config);
    setWritten(config);
    setForm(next);
  };
  const update: SiteDesignFieldsProps<SiteDesignForm>["update"] = (
    key,
    value
  ) => change({ ...form, [key]: value });
  if (section === "styling") {
    return <SiteStylingFields form={form} update={update} />;
  }
  if (section === "branding") {
    return <SiteDesignBranding change={change} form={form} update={update} />;
  }
  if (section === "typography") {
    return (
      <>
        <Tabs
          className="mb-4"
          value={form.typographyMode}
          onValueChange={(mode) => {
            if (mode === "single" || mode === "pair") {
              change({
                ...form,
                typographyMode: mode,
                ...(mode === "pair"
                  ? { body: form.font }
                  : { font: form.body }),
              });
            }
          }}
        >
          <TabsList aria-label={t("typography.modeLabel")}>
            <TabsTrigger value="single">
              {t("typography.modes.single")}
            </TabsTrigger>
            <TabsTrigger value="pair">{t("typography.modes.pair")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <SiteSettingsList>
          <SiteTypographyFields form={form} update={update} />
        </SiteSettingsList>
      </>
    );
  }
  if (section === "banner") {
    return (
      <SiteSettingsList>
        <SiteBannerFields form={form} update={update} />
      </SiteSettingsList>
    );
  }
  if (section === "seo") {
    return (
      <SiteSettingsList>
        <SiteSeoFields form={form} update={update} />
      </SiteSettingsList>
    );
  }
  if (section === "footer") {
    return (
      <SiteSettingsList>
        <SiteFooterFields
          form={form}
          patch={(patch) => change({ ...form, ...patch })}
          update={update}
        />
      </SiteSettingsList>
    );
  }
  if (section === "navbar") {
    return (
      <SiteSettingsList>
        <SiteNavbarFields form={form} update={update} />
      </SiteSettingsList>
    );
  }
  return (
    <SiteSettingsList>
      <SiteGeneralFields form={form} update={update} />
    </SiteSettingsList>
  );
}

function SiteDesignBranding({ form, update, change }: SiteDesignBrandingProps) {
  const t = useTranslations("sites.design");
  const [brandOpen, setBrandOpen] = useState(false);
  const { brand, available } = useSiteBrandDefaults();
  const brandChanges = brand ? describeBrandForDesign(brand, form) : [];
  const synced = Boolean(brand) && brandChanges.length === 0;
  return (
    <div className="space-y-4">
      {/* Shown while the brand identity loads, so the fields below never jump. */}
      {available ? (
        <SiteSettingsList>
          <SiteSettingsItem
            description={t("brandHint")}
            icon={SparklesIcon}
            title={t("brandTitle")}
            value={
              synced ? (
                <span className="text-muted-foreground flex h-8 items-center justify-end gap-1.5 text-sm">
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="text-success size-4 shrink-0"
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={2}
                  />
                  {t("brandApplied")}
                </span>
              ) : (
                <Button
                  // Stays disabled while loading or when the identity has no usable defaults.
                  disabled={!brand}
                  onClick={() => setBrandOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  {t("applyBrand")}
                </Button>
              )
            }
          />
        </SiteSettingsList>
      ) : null}
      <SiteSettingsList>
        <SiteBrandingFields form={form} update={update} />
      </SiteSettingsList>
      {brand ? (
        <SiteBrandDialog
          open={brandOpen}
          onOpenChange={setBrandOpen}
          changes={brandChanges}
          onConfirm={() => {
            change(applyBrandToDesign(brand, form));
            setBrandOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
