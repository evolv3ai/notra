"use client";

import {
  Add01Icon,
  Cancel01Icon,
  CursorPointer01Icon,
  Link01Icon,
  Menu01Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_NAVBAR_LINK_TYPES } from "@notra/sites-core/constants/site-layout";
import { Input } from "@notra/ui/components/ui/input";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteOptionSelect } from "@/components/sites/site-option-select";
import {
  SiteSettingsBlock,
  SiteSettingsItem,
} from "@/components/sites/site-settings-item";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
  SiteNavbarButton,
  SiteNavbarLinkForm,
} from "@/types/site-design";
import { newNavbarLink } from "@/utils/site-design";

const NAVBAR_BUTTONS: readonly SiteNavbarButton[] = [
  "none",
  "button",
  ...SITE_NAVBAR_LINK_TYPES,
];

export function SiteNavbarFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.navbar");
  const setLink = (id: string, patch: Partial<SiteNavbarLinkForm>) =>
    update(
      "navbarLinks",
      form.navbarLinks.map((link) =>
        link.id === id ? { ...link, ...patch } : link
      )
    );
  return (
    <>
      <SiteSettingsItem
        description={t("buttonHint")}
        icon={CursorPointer01Icon}
        title={t("button")}
        value={
          <SiteOptionSelect
            label={t("button")}
            onChange={(value) => update("navbarButton", value)}
            options={NAVBAR_BUTTONS.map((value) => ({
              value,
              label: t(`buttons.${value}`),
            }))}
            value={form.navbarButton}
          />
        }
      />
      {form.navbarButton === "button" ? (
        <SiteSettingsItem
          icon={Tag01Icon}
          errorPath="navbar.cta.label"
          title={t("buttonLabel")}
          value={
            <Input
              aria-label={t("buttonLabel")}
              autoComplete="off"
              className="w-full sm:w-80"
              maxLength={60}
              onChange={(event) =>
                update("navbarButtonLabel", event.target.value)
              }
              placeholder={t("buttonLabelPlaceholder")}
              value={form.navbarButtonLabel}
            />
          }
        />
      ) : null}
      {form.navbarButton === "none" ? null : (
        <SiteSettingsItem
          icon={Link01Icon}
          errorPath="navbar"
          title={t("buttonHref")}
          value={
            <Input
              aria-label={t("buttonHref")}
              autoComplete="off"
              className="w-full sm:w-80"
              onChange={(event) =>
                update("navbarButtonHref", event.target.value)
              }
              placeholder="https://"
              spellCheck={false}
              value={form.navbarButtonHref}
            />
          }
        />
      )}
      <SiteSettingsBlock
        description={t("linksHint")}
        icon={Menu01Icon}
        errorPath="navbar.links"
        title={t("links")}
      >
        <div className="space-y-2">
          {form.navbarLinks.map((link, index) => (
            <div
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem] items-center gap-2"
              key={link.id}
            >
              <Input
                aria-label={t("linkLabel", { number: index + 1 })}
                autoComplete="off"
                maxLength={60}
                onChange={(event) =>
                  setLink(link.id, { label: event.target.value })
                }
                placeholder={t("linkLabelPlaceholder")}
                value={link.label}
              />
              <Input
                aria-label={t("linkHref", { number: index + 1 })}
                autoComplete="off"
                onChange={(event) =>
                  setLink(link.id, { href: event.target.value })
                }
                placeholder="https:// or /path"
                spellCheck={false}
                value={link.href}
              />
              <Button
                aria-label={t("removeLink", { number: index + 1 })}
                onClick={() =>
                  update(
                    "navbarLinks",
                    form.navbarLinks.filter((item) => item.id !== link.id)
                  )
                }
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
              </Button>
            </div>
          ))}
          <Button
            onClick={() =>
              update("navbarLinks", [...form.navbarLinks, newNavbarLink()])
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Add01Icon}
            />
            {t("addLink")}
          </Button>
        </div>
      </SiteSettingsBlock>
    </>
  );
}
