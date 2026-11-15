"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POST_EXCERPT_MAX_LENGTH } from "@notra/ai/constants/post-metadata";
import { POST_EXCERPT_RECOMMENDED_LENGTH } from "@notra/schemas/constants/dashboard/post-metadata";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { cn } from "@notra/ui/lib/utils";
import { slugify } from "@notra/utils/slugify";
import { useId, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentDetailSourceMetadata } from "@/components/content/content-detail-source-metadata";
import { ContentAuthorsDialog } from "@/components/content/overview/content-authors-dialog";
import { ContentStatusBadge } from "@/components/content/overview/content-status-badge";
import { OverviewAuthorSelect } from "@/components/content/overview/overview-author-select";
import { OverviewCoverField } from "@/components/content/overview/overview-cover-field";
import { OverviewDateField } from "@/components/content/overview/overview-date-field";
import {
  OverviewField,
  OverviewToggleRow,
} from "@/components/content/overview/overview-field";
import { OverviewTagsInput } from "@/components/content/overview/overview-tags-input";
import { RecommendationsSection } from "@/components/content/recommendations-section";
import { SITE_ENTRY_DIRECTORIES } from "@/constants/site-github-publish";
import { useContentMetadata } from "@/lib/hooks/use-content-metadata";
import type {
  ContentOverviewProps,
  OverviewCreatedByRowProps,
  OverviewDisclosureProps,
} from "@/types/content/overview";
import { parseSourceMetadata } from "@/utils/content-detail";
import { formatSnakeCaseLabel } from "@/utils/format";
import { extractMarkdownExcerpt } from "@/utils/site-github-publish";

function OverviewDisclosure({ label, children }: OverviewDisclosureProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-sm transition-colors [&[data-panel-open]>svg]:rotate-0">
        <HugeiconsIcon
          className="-rotate-90 transition-transform"
          icon={ArrowDown01Icon}
          size={14}
        />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function OverviewCreatedByRow({ sourceMetadata }: OverviewCreatedByRowProps) {
  const t = useTranslations("content.overview.source");
  const tSource = useTranslations("content.detail.source");
  const source = parseSourceMetadata(sourceMetadata);
  if (!source) {
    return null;
  }
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="text-foreground text-[13px] font-medium">
        {t("createdBy")}
      </span>
      <span className="text-muted-foreground min-w-0 truncate text-xs">
        {tSource("trigger", {
          type: source.triggerSourceType,
          fallback: formatSnakeCaseLabel(source.triggerSourceType),
        })}
      </span>
    </div>
  );
}

export function ContentOverview(props: ContentOverviewProps) {
  const { organizationId, contentId, content } = props;
  const t = useTranslations("content.overview");
  const ids = { description: useId(), date: useId() };
  const [authorsOpen, setAuthorsOpen] = useState(false);
  const api = useContentMetadata({ organizationId, contentId, content });
  const { metadata } = api;
  const isBlog = content.contentType === "blog_post";
  const markdown = content.markdown ?? "";
  const autoExcerpt = useMemo(
    () => extractMarkdownExcerpt(markdown),
    [markdown]
  );
  const section = SITE_ENTRY_DIRECTORIES[isBlog ? "blog_post" : "changelog"];
  const slug = content.slug || slugify(content.title);
  const hasSource = parseSourceMetadata(content.sourceMetadata) !== null;
  const hasRecommendations = Boolean(content.recommendations?.trim());
  const descriptionLength = metadata.excerpt?.length ?? 0;

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-1">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-foreground text-[13px] font-medium">
            {t("status.label")}
          </span>
          <ContentStatusBadge status={content.status} />
        </div>
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-foreground text-[13px] font-medium">
            {t("url")}
          </span>
          <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
            /{section}/{slug}
          </span>
        </div>
        <OverviewCreatedByRow sourceMetadata={content.sourceMetadata} />
        {isBlog ? (
          <OverviewToggleRow
            checked={metadata.featured}
            hint={t("featured.hint")}
            label={t("featured.label")}
            onCheckedChange={(featured) => api.update({ featured })}
          />
        ) : null}
        {isBlog ? (
          <OverviewToggleRow
            checked={!(metadata.hidden || metadata.noindex)}
            disabled={metadata.hidden}
            hint={t("indexed.hint")}
            label={t("indexed.label")}
            onCheckedChange={(visible) => api.update({ noindex: !visible })}
          />
        ) : null}
        <OverviewToggleRow
          checked={metadata.hidden}
          hint={t("hidden.hint")}
          label={t("hidden.label")}
          onCheckedChange={(hidden) => api.update({ hidden })}
        />
        {props.children}
      </div>

      <div className="bg-border h-px" />

      <OverviewField hint={t("cover.hint")} label={t("cover.label")}>
        <OverviewCoverField api={api} markdown={markdown} />
      </OverviewField>

      <OverviewField
        hint={t("description.hint")}
        htmlFor={ids.description}
        label={t("description.label")}
      >
        <Textarea
          className="min-h-20 resize-none"
          id={ids.description}
          maxLength={POST_EXCERPT_MAX_LENGTH}
          onChange={(event) =>
            api.updateDebounced({ excerpt: event.target.value })
          }
          placeholder={autoExcerpt}
          value={metadata.excerpt ?? ""}
        />
        <p
          className={cn(
            "text-muted-foreground text-xs tabular-nums",
            descriptionLength > POST_EXCERPT_RECOMMENDED_LENGTH &&
              "text-amber-600 dark:text-amber-400"
          )}
        >
          {descriptionLength > 0
            ? t("description.count", {
                count: descriptionLength,
                max: POST_EXCERPT_RECOMMENDED_LENGTH,
              })
            : t("description.auto")}
        </p>
      </OverviewField>

      {isBlog ? (
        <OverviewField
          aside={
            <Button
              className="-my-1"
              onClick={() => setAuthorsOpen(true)}
              size="xs"
              variant="ghost"
            >
              {t("authors.manage")}
            </Button>
          }
          hint={t("authors.hint")}
          label={t("authors.label")}
        >
          <OverviewAuthorSelect
            authorIds={metadata.authorIds}
            onChange={(authorIds) => api.update({ authorIds })}
            organizationId={organizationId}
          />
          <ContentAuthorsDialog
            onOpenChange={setAuthorsOpen}
            open={authorsOpen}
            organizationId={organizationId}
          />
        </OverviewField>
      ) : null}

      <OverviewField hint={t("tags.hint")} label={t("tags.label")}>
        <OverviewTagsInput
          onChange={(tags) => api.update({ tags })}
          organizationId={organizationId}
          tags={metadata.tags}
        />
      </OverviewField>

      <OverviewField
        hint={t("date.hint")}
        htmlFor={ids.date}
        label={t("date.label")}
      >
        <OverviewDateField
          fallback={content.date.slice(0, 10)}
          id={ids.date}
          onChange={(displayDate) => api.update({ displayDate })}
          value={metadata.displayDate}
        />
      </OverviewField>

      {hasSource || hasRecommendations ? (
        <>
          <div className="bg-border h-px" />
          <div className="space-y-3">
            {hasSource ? (
              <OverviewDisclosure label={t("source.label")}>
                <ContentDetailSourceMetadata
                  organizationId={organizationId}
                  sourceMetadata={content.sourceMetadata}
                />
              </OverviewDisclosure>
            ) : null}
            <RecommendationsSection value={content.recommendations} />
          </div>
        </>
      ) : null}
    </div>
  );
}
