import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { CreateContentButtonGroup } from "@/components/content/create-content-button-group";
import { PageContainer } from "@/components/layout/container";

import { CollectionsPageSkeleton } from "./skeleton";

function noop() {}

export default function Loading() {
  const t = useTranslations("content.list");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.content")}
        >
          <CreateContentButtonGroup
            disabled
            onCreateContent={noop}
            onCreatePost={noop}
          />
        </PageHeading>
        <div className="space-y-3">
          <div className="flex min-h-8 items-center">
            <Skeleton className="h-8 w-[14.125rem] rounded-lg" />
          </div>
          <CollectionsPageSkeleton />
        </div>
      </div>
    </PageContainer>
  );
}
