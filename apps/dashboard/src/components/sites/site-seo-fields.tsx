"use client";

import {
  Add01Icon,
  Cancel01Icon,
  CodeSquareIcon,
  SearchVisualIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteOptionSelect } from "@/components/sites/site-option-select";
import {
  SiteSettingsBlock,
  SiteSettingsItem,
} from "@/components/sites/site-settings-item";
import { SITE_SEO_INDEXING_MODES } from "@/constants/site-design";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
  SiteMetaTagForm,
} from "@/types/site-design";
import {
  duplicateMetaTagNames,
  invalidMetaTagIds,
  newMetaTag,
} from "@/utils/site-design";

export function SiteSeoFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.seo");
  const duplicates = duplicateMetaTagNames(form.metaTags);
  const invalid = invalidMetaTagIds(form.metaTags);
  const [duplicate] = duplicates;
  let problem: string | null = null;
  if (invalid.size > 0) {
    problem = t("invalidTag");
  } else if (duplicate) {
    problem = t("duplicateTag", { name: duplicate });
  }
  const setTag = (id: string, patch: Partial<SiteMetaTagForm>) =>
    update(
      "metaTags",
      form.metaTags.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag))
    );
  return (
    <>
      <SiteSettingsBlock
        description={t("metaTagsHint")}
        icon={CodeSquareIcon}
        errorPath={problem ? undefined : "seo.metatags"}
        title={t("metaTags")}
      >
        <div className="space-y-2">
          {form.metaTags.map((tag, index) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2"
              key={tag.id}
            >
              <Input
                aria-invalid={
                  invalid.has(tag.id) ||
                  duplicates.has(tag.name.trim().toLowerCase()) ||
                  undefined
                }
                aria-label={t("tagName", { number: index + 1 })}
                autoComplete="off"
                onChange={(event) =>
                  setTag(tag.id, { name: event.target.value })
                }
                placeholder={t("tagNamePlaceholder")}
                spellCheck={false}
                value={tag.name}
              />
              <Input
                aria-label={t("tagContent", { number: index + 1 })}
                autoComplete="off"
                maxLength={500}
                onChange={(event) =>
                  setTag(tag.id, { content: event.target.value })
                }
                placeholder={t("tagContentPlaceholder")}
                spellCheck={false}
                value={tag.content}
              />
              <Button
                aria-label={t("removeTag", { number: index + 1 })}
                onClick={() =>
                  update(
                    "metaTags",
                    form.metaTags.filter((item) => item.id !== tag.id)
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
          {problem ? (
            <p className="text-destructive text-xs" role="alert">
              {problem}
            </p>
          ) : null}
          <Button
            onClick={() => update("metaTags", [...form.metaTags, newMetaTag()])}
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Add01Icon}
            />
            {t("addTag")}
          </Button>
        </div>
      </SiteSettingsBlock>
      <SiteSettingsItem
        description={t("indexingHint")}
        icon={SearchVisualIcon}
        errorPath="seo.indexing"
        title={t("indexing")}
        value={
          <SiteOptionSelect
            label={t("indexing")}
            onChange={(value) => update("seoIndexing", value)}
            options={SITE_SEO_INDEXING_MODES.map((value) => ({
              value,
              label: t(`indexingModes.${value}`),
            }))}
            value={form.seoIndexing}
          />
        }
      />
    </>
  );
}
