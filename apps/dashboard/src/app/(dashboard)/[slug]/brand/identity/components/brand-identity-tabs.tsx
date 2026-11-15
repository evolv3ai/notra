"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import type { BrandIdentityTabsProps, BrandTab } from "@/types/brand-identity";

import { BrandForm } from "./brand-form";
import { GuidelinesPanel } from "./guidelines-panel";
import { ReferencesList } from "./references-list";
import { SitemapList } from "./sitemap-list";

export function BrandIdentityTabs({
  activeTab,
  toolbar,
  addReferenceOpen,
  addSitemapOpen,
  initialData,
  isSaving,
  onActiveTabChange,
  onAddReferenceOpenChange,
  onAddSitemapOpenChange,
  onSavingChange,
  organizationId,
  voiceId,
  voiceWebsiteUrl,
}: BrandIdentityTabsProps) {
  const t = useTranslations("brand.identity.tabs");
  const tCommon = useTranslations("common");
  const tStates = useTranslations("common.actions");
  return (
    <Tabs
      onValueChange={(value) => onActiveTabChange(value as BrandTab)}
      value={activeTab}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4">
        <div className="max-w-full min-w-0 overflow-x-auto pb-2">
          <TabsList aria-label={t("label")}>
            <TabsTrigger value="identity">
              {tCommon("labels.companyInfo")}
            </TabsTrigger>
            <TabsTrigger value="guidelines">{t("guidelines")}</TabsTrigger>
            <TabsTrigger value="references">
              {tCommon("labels.references")}
            </TabsTrigger>
            <TabsTrigger value="sitemap">
              {tCommon("labels.sitemap")}
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3 pb-2">
          {activeTab === "identity" && isSaving ? (
            <span
              aria-live="polite"
              className="text-muted-foreground text-xs"
              role="status"
            >
              {tStates("saving")}
            </span>
          ) : null}
          {toolbar}
        </div>
      </div>

      <TabsContent className="mt-6" value="identity">
        <BrandForm
          initialData={initialData}
          key={voiceId}
          onSavingChange={onSavingChange}
          organizationId={organizationId}
          voiceId={voiceId}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="guidelines">
        <GuidelinesPanel
          key={`guidelines-${voiceId}`}
          organizationId={organizationId}
          voiceId={voiceId}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="references">
        <ReferencesList
          dialogOpen={addReferenceOpen}
          key={`refs-${voiceId}`}
          onDialogOpenChange={onAddReferenceOpenChange}
          organizationId={organizationId}
          voiceId={voiceId}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="sitemap">
        <SitemapList
          dialogOpen={addSitemapOpen}
          key={`sitemap-${voiceId}`}
          onDialogOpenChange={onAddSitemapOpenChange}
          organizationId={organizationId}
          voiceId={voiceId}
          voiceWebsiteUrl={voiceWebsiteUrl}
        />
      </TabsContent>
    </Tabs>
  );
}
