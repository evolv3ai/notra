"use client";

import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Button } from "@notra/ui/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { ContentCard } from "@/components/content/content-card";
import { ContentSkeletonCard } from "@/components/content/content-skeleton-card";
import { GroupContentTypes } from "@/components/content/group/group-content-types";
import { RenameCollectionDialog } from "@/components/content/group/rename-collection-dialog";
import { EmptyState } from "@/components/empty-state";
import { EmptyStateCardsPreview } from "@/components/empty-state-preview";
import Link from "@/components/framework/link";
import { BackLink } from "@/components/layout/back-link";
import { PageContainer } from "@/components/layout/container";
import { EMPTY_STATE_CARD_COUNT } from "@/constants/empty-state";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { useCollection } from "@/lib/hooks/use-collections";
import type { CollectionDetailPageClientProps } from "@/types/content/collection";
import { formatLongDate } from "@/utils/content-preview";
import { resolveImagePreviewSrc } from "@/utils/markdown-image";

import { GroupDetailSkeleton } from "./skeleton";

export default function PageClient({
  collectionId,
  organizationId,
  organizationSlug,
}: CollectionDetailPageClientProps) {
  const t = useTranslations("content.collections.detail");
  const tCommon = useTranslations("common");
  const tContentShared = useTranslations("content.shared");
  const tDetail = useTranslations("content.detail");
  const tStates = useTranslations("common.states");
  const locale = useLocale();
  const { data, isPending, error } = useCollection(
    organizationId,
    collectionId
  );
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const hasTrackedOpenRef = useRef(false);

  useEffect(() => {
    const loadedCollection = data?.collection;
    if (!loadedCollection || hasTrackedOpenRef.current) {
      return;
    }
    hasTrackedOpenRef.current = true;
    trackEvent(POSTHOG_EVENTS.COLLECTION_OPENED, {
      collection_id: collectionId,
      post_count: loadedCollection.posts.length,
      is_generating: loadedCollection.isGenerating,
    });
  }, [collectionId, data?.collection]);

  if (isPending) {
    return <GroupDetailSkeleton />;
  }

  if (error || !data?.collection) {
    return (
      <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="w-full px-4 lg:px-6">
          <EmptyState
            action={
              <Button
                nativeButton={false}
                render={<Link href={`/${organizationSlug}/content`} />}
                variant="outline"
              >
                {tDetail("backToContent")}
              </Button>
            }
            description={t("notFoundDescription")}
            title={t("notFoundTitle")}
          />
        </div>
      </PageContainer>
    );
  }

  const collection = data.collection;
  const postCountLabel = tCommon("messages.countPluralOnePostOther", {
    count: collection.posts.length,
  });

  const pendingCount =
    collection.isGenerating && collection.expectedPostCount !== null
      ? Math.max(0, collection.expectedPostCount - collection.posts.length)
      : 0;
  const pendingTypes = Array.from({ length: pendingCount }, (_, index) =>
    collection.contentTypes.length > 0
      ? (collection.contentTypes[index % collection.contentTypes.length] ??
        "blog_post")
      : "blog_post"
  );
  const hasContent = collection.posts.length > 0 || pendingCount > 0;

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <div className="space-y-3">
          <BackLink href={`/${organizationSlug}/content`}>
            {tCommon("labels.content")}
          </BackLink>
          <PageHeading
            description={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{postCountLabel}</span>
                <span aria-hidden>·</span>
                <time dateTime={collection.createdAt}>
                  {formatLongDate(collection.createdAt, locale)}
                </time>
              </span>
            }
            title={
              <span className="inline-flex max-w-full items-center gap-2">
                <span className="min-w-0">{collection.name}</span>
                <Button
                  className="text-muted-foreground shrink-0"
                  onClick={() => setShowRenameDialog(true)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <span className="sr-only">
                    {tContentShared("renameCollection")}
                  </span>
                  <HugeiconsIcon className="size-4" icon={PencilEdit02Icon} />
                </Button>
              </span>
            }
          >
            <GroupContentTypes contentTypes={collection.contentTypes} />
          </PageHeading>
        </div>

        {hasContent && (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {collection.posts.map((post) => (
              <ContentCard
                contentSubtype={post.contentSubtype}
                contentType={post.contentType}
                href={`/${organizationSlug}/content/${post.id}?fromCollection=${encodeURIComponent(collection.id)}`}
                id={post.id}
                imagePreviewSrc={
                  post.contentType === "image"
                    ? resolveImagePreviewSrc({
                        content: post.content,
                        markdown: post.markdown,
                      })
                    : null
                }
                key={post.id}
                organizationId={organizationId}
                preview={post.preview}
                status={post.status}
                title={post.title}
              />
            ))}
            {pendingTypes.map((type, index) => (
              <ContentSkeletonCard key={`pending-${index}`} outputType={type} />
            ))}
          </div>
        )}

        {!hasContent && (
          <EmptyState
            description={t("emptyDescription")}
            preview={
              <EmptyStateCardsPreview
                columns={3}
                count={EMPTY_STATE_CARD_COUNT.content}
                variant="content"
              />
            }
            title={tStates("empty")}
          />
        )}
      </div>

      <RenameCollectionDialog
        collectionId={collection.id}
        currentName={collection.name}
        onOpenChange={setShowRenameDialog}
        open={showRenameDialog}
        organizationId={organizationId}
      />
    </PageContainer>
  );
}
