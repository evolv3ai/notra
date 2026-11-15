"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Label } from "@notra/ui/components/ui/label";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useQueryState } from "nuqs";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { PageContainer } from "@/components/layout/container";
import { cn } from "@/lib/utils";
import type { BrandSkeletonFieldProps } from "@/types/brand-identity";
import { brandIdentityViewParser } from "@/utils/brand-identity-search-params";

/** Mirrors the selected tab so its content lands where the skeleton was. */
export function BrandIdentityPageSkeleton() {
  const t = useTranslations("brand.identity.form");
  const tTabs = useTranslations("brand.identity.tabs");
  const tCommon = useTranslations("common");
  const tBrandShared = useTranslations("brand.shared");
  const [view] = useQueryState(
    "view",
    brandIdentityViewParser.withDefault("identity")
  );
  const actionLabel = {
    identity: tBrandShared("createIdentity"),
    references: tBrandShared("addReference"),
    sitemap: tBrandShared("addSitemap"),
    guidelines: null,
  }[view];
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-5 px-4 lg:px-6">
        <Tabs value={view}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4">
            <div className="max-w-full min-w-0 overflow-x-auto pb-2">
              <TabsList aria-label={tTabs("label")}>
                <TabsTrigger disabled value="identity">
                  {tCommon("labels.companyInfo")}
                </TabsTrigger>
                <TabsTrigger disabled value="guidelines">
                  {tTabs("guidelines")}
                </TabsTrigger>
                <TabsTrigger disabled value="references">
                  {tCommon("labels.references")}
                </TabsTrigger>
                <TabsTrigger disabled value="sitemap">
                  {tCommon("labels.sitemap")}
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 pb-2">
              {actionLabel ? (
                <Button disabled>
                  <HugeiconsIcon className="size-4" icon={Add01Icon} />
                  {actionLabel}
                  <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
                </Button>
              ) : (
                <>
                  <Skeleton className="h-8 w-32 rounded-md" />
                  <Skeleton className="h-8 w-40 rounded-md" />
                </>
              )}
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
          {view === "identity" ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <TitleCard heading={t("companyProfileHeading")}>
                <div className="space-y-6">
                  <SkeletonField label={tCommon("labels.companyName")} />
                  <SkeletonField label={tCommon("labels.website")} />
                  <SkeletonField label={tCommon("labels.description")} tall />
                </div>
              </TitleCard>
              <TitleCard
                action={<Skeleton className="h-7 w-[8.25rem] rounded-lg" />}
                heading={t("toneLanguageHeading")}
              >
                <div className="space-y-6">
                  <SkeletonField label={t("customToneLabel")} tall />
                  <SkeletonField label={tCommon("labels.language")} />
                </div>
              </TitleCard>
              <TitleCard
                className="lg:col-span-2"
                heading={t("customInstructionsLabel")}
              >
                <Skeleton className="h-24 w-full rounded-md" />
              </TitleCard>
              <TitleCard
                className="lg:col-span-2"
                heading={t("audienceHeading")}
              >
                <SkeletonField label={t("audienceLabel")} tall />
              </TitleCard>
            </div>
          ) : (
            <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
          )}
        </Tabs>
      </div>
    </PageContainer>
  );
}

function SkeletonField({ label, tall = false }: BrandSkeletonFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Skeleton className={cn("w-full rounded-md", tall ? "h-24" : "h-8")} />
    </div>
  );
}
