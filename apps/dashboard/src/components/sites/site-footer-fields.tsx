"use client";

import {
  Add01Icon,
  Cancel01Icon,
  Globe02Icon,
  LayoutThreeColumnIcon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Input } from "@notra/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@notra/ui/components/ui/input-group";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Image from "@/components/framework/image";
import { SiteDesignError } from "@/components/sites/site-design-error";
import {
  SiteSettingsBlock,
  SiteSettingsSwitchItem,
} from "@/components/sites/site-settings-item";
import {
  SITE_FOOTER_COLUMN_LIMIT,
  SITE_FOOTER_COLUMN_LINK_LIMIT,
  SITE_SOCIAL_LINKS,
} from "@/constants/site-design";
import type {
  SiteDesignForm,
  SiteFooterColumnFieldsProps,
  SiteFooterFieldsProps,
  SiteFooterSocialRowProps,
  SiteSocialPlatform,
} from "@/types/site-design";
import { getGoogleFaviconUrl, getWebsiteDomain } from "@/utils/brand";
import {
  isBlankFooterColumn,
  newFooterColumn,
  newFooterLink,
  newFooterSocial,
  socialHandle,
  socialUrl,
} from "@/utils/site-design";

const PLATFORMS = Object.keys(SITE_SOCIAL_LINKS) as SiteSocialPlatform[];

function SocialIcon({ platform, url }: { platform: string; url?: string }) {
  const meta = SITE_SOCIAL_LINKS[platform as SiteSocialPlatform];
  // The live footer shows the linked site's favicon for websites, so match it.
  const favicon =
    platform === "website" && url && /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(url)
      ? getGoogleFaviconUrl(getWebsiteDomain(url))
      : undefined;
  if (favicon) {
    return (
      <Image
        alt=""
        className="size-4 shrink-0 rounded-sm"
        height={16}
        src={favicon}
        unoptimized
        width={16}
      />
    );
  }
  const Logo = meta.logo;
  if (Logo) {
    return <Logo aria-hidden="true" className="size-4 shrink-0" />;
  }
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className="size-4 shrink-0"
      icon={Globe02Icon}
      strokeWidth={1.75}
    />
  );
}

function SocialRow({ social, onChange, onRemove }: SiteFooterSocialRowProps) {
  const t = useTranslations("sites.design.footer");
  const { label } = SITE_SOCIAL_LINKS[social.platform];
  const { prefix, value } = socialHandle(social);
  const inputId = `footer-social-${social.id}`;
  // While typing, keep the icon of the URL the field had on focus, so partial
  // domains don't each load a favicon.
  const [focusedUrl, setFocusedUrl] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <label
        className="flex items-center gap-2 text-sm font-medium"
        htmlFor={inputId}
      >
        <SocialIcon platform={social.platform} url={focusedUrl ?? social.url} />
        {label}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2">
        <InputGroup>
          {prefix ? (
            <InputGroupAddon>
              <InputGroupText>{prefix}</InputGroupText>
            </InputGroupAddon>
          ) : null}
          <InputGroupInput
            autoCapitalize="none"
            autoComplete="off"
            id={inputId}
            onBlur={() => setFocusedUrl(null)}
            onFocus={() => setFocusedUrl(social.url)}
            onChange={(event) =>
              onChange(socialUrl(social.platform, event.target.value))
            }
            placeholder={prefix ? t("handlePlaceholder") : "https://"}
            spellCheck={false}
            value={value}
          />
        </InputGroup>
        <Button
          aria-label={t("removeSocial", { platform: label })}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
        </Button>
      </div>
      <SiteDesignError path={`footer.socials.${social.platform}`} />
    </div>
  );
}

function ColumnFields({
  column,
  index,
  errorPath,
  onChange,
  onRemove,
}: SiteFooterColumnFieldsProps) {
  const t = useTranslations("sites.design.footer");
  const number = index + 1;
  const setLink = (id: string, patch: { label?: string; href?: string }) =>
    onChange({
      ...column,
      links: column.links.map((link) =>
        link.id === id ? { ...link, ...patch } : link
      ),
    });
  return (
    <div className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{t("column", { number })}</h3>
        <Button
          aria-label={t("removeColumn", { number })}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
        </Button>
      </div>
      <Input
        aria-label={t("columnHeader", { number })}
        autoComplete="off"
        maxLength={60}
        onChange={(event) =>
          onChange({ ...column, header: event.target.value })
        }
        placeholder={t("columnHeaderPlaceholder")}
        value={column.header}
      />
      <div className="space-y-2">
        {column.links.map((link, linkIndex) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2"
            key={link.id}
          >
            <Input
              aria-label={t("linkLabel", {
                column: number,
                number: linkIndex + 1,
              })}
              autoComplete="off"
              maxLength={60}
              onChange={(event) =>
                setLink(link.id, { label: event.target.value })
              }
              placeholder={t("linkLabelPlaceholder")}
              value={link.label}
            />
            <Input
              aria-label={t("linkHref", {
                column: number,
                number: linkIndex + 1,
              })}
              autoComplete="off"
              onChange={(event) =>
                setLink(link.id, { href: event.target.value })
              }
              placeholder={t("linkHrefPlaceholder")}
              spellCheck={false}
              value={link.href}
            />
            <Button
              aria-label={t("removeLink", {
                column: number,
                number: linkIndex + 1,
              })}
              onClick={() =>
                onChange({
                  ...column,
                  links: column.links.filter((item) => item.id !== link.id),
                })
              }
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
            </Button>
          </div>
        ))}
      </div>
      {column.links.length < SITE_FOOTER_COLUMN_LINK_LIMIT ? (
        <Button
          onClick={() =>
            onChange({ ...column, links: [...column.links, newFooterLink()] })
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
      ) : null}
      <SiteDesignError path={errorPath} />
    </div>
  );
}

export function SiteFooterFields({
  form,
  update,
  patch,
}: SiteFooterFieldsProps) {
  const t = useTranslations("sites.design.footer");
  const used = new Set(form.footerSocials.map((social) => social.platform));
  const available = PLATFORMS.filter((platform) => !used.has(platform));
  const setColumns = (columns: SiteDesignForm["footerColumns"]) =>
    update("footerColumns", columns);
  // Blank columns aren't saved, so later columns sit at a lower index in blog.json.
  const errorPaths = form.footerColumns.map((column, index) =>
    isBlankFooterColumn(column)
      ? undefined
      : `footer.links.${
          form.footerColumns
            .slice(0, index)
            .filter((item) => !isBlankFooterColumn(item)).length
        }`
  );
  return (
    <>
      <SiteSettingsBlock
        description={t("socialsHint")}
        icon={Share08Icon}
        title={t("socials")}
      >
        <div className="grid gap-4">
          {form.footerSocials.map((social) => (
            <SocialRow
              key={social.id}
              onChange={(url) =>
                update(
                  "footerSocials",
                  form.footerSocials.map((item) =>
                    item.id === social.id ? { ...item, url } : item
                  )
                )
              }
              onRemove={() =>
                update(
                  "footerSocials",
                  form.footerSocials.filter((item) => item.id !== social.id)
                )
              }
              social={social}
            />
          ))}
          {available.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-fit"
                render={<Button size="sm" type="button" variant="outline" />}
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                  icon={Add01Icon}
                />
                {t("addSocial")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {available.map((platform) => (
                  <DropdownMenuItem
                    key={platform}
                    onClick={() =>
                      update("footerSocials", [
                        ...form.footerSocials,
                        newFooterSocial(platform),
                      ])
                    }
                  >
                    <SocialIcon platform={platform} />
                    {SITE_SOCIAL_LINKS[platform].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </SiteSettingsBlock>
      <SiteSettingsSwitchItem
        checked={form.footerColumnsEnabled}
        description={t("columnsHint")}
        icon={LayoutThreeColumnIcon}
        onCheckedChange={(checked) =>
          patch({
            footerColumnsEnabled: checked,
            ...(checked && form.footerColumns.length === 0
              ? { footerColumns: [newFooterColumn(form.footerFlatLinks)] }
              : {}),
          })
        }
        title={t("columns")}
      />
      {form.footerColumnsEnabled ? (
        <div className="space-y-4 border-b px-4 py-4 sm:px-5 sm:pl-14">
          {form.footerColumns.map((column, index) => (
            <ColumnFields
              column={column}
              errorPath={errorPaths[index]}
              index={index}
              key={column.id}
              onChange={(next) =>
                setColumns(
                  form.footerColumns.map((item) =>
                    item.id === column.id ? next : item
                  )
                )
              }
              onRemove={() => {
                const rest = form.footerColumns.filter(
                  (item) => item.id !== column.id
                );
                patch({
                  footerColumns: rest,
                  footerColumnsEnabled: rest.length > 0,
                });
              }}
            />
          ))}
          {form.footerColumns.length < SITE_FOOTER_COLUMN_LIMIT ? (
            <Button
              onClick={() =>
                setColumns([...form.footerColumns, newFooterColumn()])
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
              {t("addColumn")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
