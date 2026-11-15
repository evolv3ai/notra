"use client";

import { Add01Icon, Refresh03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type {
  BrandIdentityActionsProps,
  BrandTab,
} from "@/types/brand-identity";

import { GuidelinesPdfUploadButton } from "./guidelines-pdf-upload-button";

export function BrandIdentityActions({
  activeTab,
  onAddIdentity,
  onAddReference,
  onAddSitemap,
  onRefreshGuidelines,
  isRefreshingGuidelines,
  menu,
  organizationId,
  voiceId,
}: BrandIdentityActionsProps) {
  const tBrandShared = useTranslations("brand.shared");
  const actionByTab: Partial<
    Record<BrandTab, { label: string; onClick: () => void }>
  > = {
    identity: {
      label: tBrandShared("createIdentity"),
      onClick: onAddIdentity,
    },
    references: {
      label: tBrandShared("addReference"),
      onClick: onAddReference,
    },
    sitemap: {
      label: tBrandShared("addSitemap"),
      onClick: onAddSitemap,
    },
  };
  const action = actionByTab[activeTab];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeTab === "guidelines" ? (
        <>
          <GuidelinesPdfUploadButton
            organizationId={organizationId}
            voiceId={voiceId}
          />
          <Button
            loading={isRefreshingGuidelines}
            onClick={onRefreshGuidelines}
          >
            <HugeiconsIcon className="size-4" icon={Refresh03Icon} />
            {tBrandShared("refreshGuidelines")}
          </Button>
        </>
      ) : null}
      {action ? (
        <Button onClick={action.onClick}>
          <HugeiconsIcon className="size-4" icon={Add01Icon} />
          {action.label}
          <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
        </Button>
      ) : null}
      {menu}
    </div>
  );
}
