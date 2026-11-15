"use client";

import {
  FileAttachmentIcon,
  TextBoldIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  SiteSettingsBlock,
  SiteSettingsItem,
} from "@/components/sites/site-settings-item";
import {
  SITE_CUSTOM_FONT,
  SITE_DEFAULT_FONT,
  SITE_FONT_FORMATS,
  SITE_FONT_SUGGESTIONS,
  SITE_FONT_WEIGHTS,
} from "@/constants/site-design";
import type {
  SiteFontFormat,
  SiteFontRowsProps,
  SiteFontWeight,
} from "@/types/site-design";

/** Font picker rows: a preset or custom family, its source and its weight. */
export function SiteFontRows({
  id,
  label,
  hint,
  weightLabel,
  weightHint,
  weightNeedsFamily = false,
  value,
  onChange,
}: SiteFontRowsProps) {
  const t = useTranslations("sites.design.typography");
  const tWeights = useTranslations("sites.design.weights");
  const isPreset = SITE_FONT_SUGGESTIONS.includes(value.family);
  const [customChosen, setCustomChosen] = useState(
    value.family !== "" && !isPreset
  );
  const custom = customChosen || (value.family !== "" && !isPreset);
  let selected = SITE_DEFAULT_FONT;
  if (custom) {
    selected = SITE_CUSTOM_FONT;
  } else if (value.family) {
    selected = value.family;
  }

  return (
    <>
      <SiteSettingsItem
        description={hint}
        icon={TextFontIcon}
        title={label}
        value={
          <div className="flex w-full flex-col gap-2 sm:w-64">
            <Select
              onValueChange={(next: string | null) => {
                if (!next) {
                  return;
                }
                setCustomChosen(next === SITE_CUSTOM_FONT);
                if (next === SITE_CUSTOM_FONT) {
                  onChange({ ...value, family: isPreset ? "" : value.family });
                  return;
                }
                onChange({
                  ...value,
                  family: next === SITE_DEFAULT_FONT ? "" : next,
                  source: "",
                  format: "",
                });
              }}
              value={selected}
            >
              <SelectTrigger aria-label={label} className="w-full">
                <SelectValue>
                  {(current: string) => {
                    if (current === SITE_DEFAULT_FONT) {
                      return t("default");
                    }
                    return current === SITE_CUSTOM_FONT ? t("custom") : current;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="end"
                alignItemWithTrigger={false}
                className="max-h-80"
              >
                <SelectItem value={SITE_DEFAULT_FONT}>
                  {t("default")}
                </SelectItem>
                {SITE_FONT_SUGGESTIONS.map((family) => (
                  <SelectItem key={family} value={family}>
                    {family}
                  </SelectItem>
                ))}
                <SelectItem value={SITE_CUSTOM_FONT}>{t("custom")}</SelectItem>
              </SelectContent>
            </Select>
            {custom ? (
              <Input
                aria-label={t("customFamily")}
                autoComplete="off"
                data-1p-ignore
                id={`${id}-family`}
                onChange={(event) =>
                  onChange({ ...value, family: event.target.value })
                }
                placeholder={t("customFamily")}
                spellCheck={false}
                value={value.family}
              />
            ) : null}
          </div>
        }
      />
      {custom ? (
        <>
          <SiteSettingsBlock
            description={t("sourceHint")}
            icon={FileAttachmentIcon}
            title={t("source")}
          >
            <Input
              aria-label={t("source")}
              autoComplete="off"
              data-1p-ignore
              id={`${id}-source`}
              onChange={(event) =>
                onChange({ ...value, source: event.target.value })
              }
              placeholder="https://example.com/fonts/MyFont.woff2"
              spellCheck={false}
              value={value.source}
            />
          </SiteSettingsBlock>
          <SiteSettingsItem
            description={t("formatHint")}
            icon={FileAttachmentIcon}
            title={t("format")}
            value={
              <Select
                onValueChange={(next: string | null) =>
                  onChange({
                    ...value,
                    format:
                      next && next !== SITE_DEFAULT_FONT
                        ? (next as SiteFontFormat)
                        : "",
                  })
                }
                value={value.format || SITE_DEFAULT_FONT}
              >
                <SelectTrigger aria-label={t("format")} className="w-40">
                  <SelectValue>
                    {(current: string) =>
                      current === SITE_DEFAULT_FONT ? t("formatAuto") : current
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" alignItemWithTrigger={false}>
                  <SelectItem value={SITE_DEFAULT_FONT}>
                    {t("formatAuto")}
                  </SelectItem>
                  {SITE_FONT_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </>
      ) : null}
      {weightNeedsFamily && !value.family ? null : (
        <SiteSettingsItem
          description={weightHint}
          icon={TextBoldIcon}
          title={weightLabel}
          value={
            <Select
              onValueChange={(next: string | null) =>
                onChange({
                  ...value,
                  weight: next && next !== SITE_DEFAULT_FONT ? next : "",
                })
              }
              value={value.weight || SITE_DEFAULT_FONT}
            >
              <SelectTrigger aria-label={weightLabel} className="w-40">
                <SelectValue>
                  {(current: string) =>
                    current === SITE_DEFAULT_FONT
                      ? t("default")
                      : `${current} · ${tWeights(current as SiteFontWeight)}`
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                <SelectItem value={SITE_DEFAULT_FONT}>
                  {t("default")}
                </SelectItem>
                {SITE_FONT_WEIGHTS.map((weight) => (
                  <SelectItem key={weight} value={weight}>
                    {weight} · {tWeights(weight)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}
    </>
  );
}
