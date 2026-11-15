"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import { SiteDomainAddDialog } from "@/components/sites/site-domain-add-dialog";
import { SiteDomainAddForm } from "@/components/sites/site-domain-add-form";
import { SiteDomainCard } from "@/components/sites/site-domain-card";
import { useDomainConnectOutcomeToast } from "@/lib/hooks/use-domain-connect-outcome-toast";
import {
  useInvalidateSites,
  useSitePlanLimitReached,
} from "@/lib/hooks/use-sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDomainRemoveDialogProps } from "@/types/components/sites";
import type { SiteDomain } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import { displayUrl } from "@/utils/site-links";

function RemoveDomainDialog({
  organizationId,
  siteId,
  domain,
  aliasOrigin,
  onOpenChange,
}: SiteDomainRemoveDialogProps) {
  const t = useTranslations("sites.domainsPage");
  const invalidateSites = useInvalidateSites();

  const removeMutation = useMutation({
    mutationFn: (domainId: string) =>
      dashboardOrpc.sites.domains.remove.call({
        organizationId,
        siteId,
        domainId,
      }),
    onSuccess: async () => {
      toast.success(t("removed"));
      onOpenChange(false);
      await invalidateSites();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, t("removeFailed")));
    },
  });

  return (
    <ConfirmDialog
      confirmLabel={t("removeConfirm")}
      description={
        domain?.isPrimary
          ? t("removePrimaryDescription", {
              hostname: domain.hostname,
              alias: displayUrl(aliasOrigin),
            })
          : t("removeDescription", { hostname: domain?.hostname ?? "" })
      }
      variant="destructive"
      onConfirm={() => {
        if (domain) {
          removeMutation.mutate(domain.id);
        }
      }}
      onOpenChange={onOpenChange}
      open={domain !== null}
      pending={removeMutation.isPending}
      title={t("removeTitle")}
    />
  );
}

export function SiteDomainsPage() {
  const { organizationId, siteId, detail } = useSite();
  const t = useTranslations("sites.domainsPage");
  const tLimits = useTranslations("sites.planLimits");
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SiteDomain | null>(null);
  const { site, domains } = detail;
  const domainLimitReached = useSitePlanLimitReached(organizationId, "domains");
  useDomainConnectOutcomeToast();

  return (
    <div className="space-y-6">
      <PageHeading description={t("description")} title={t("title")}>
        {domains.length > 0 && !domainLimitReached ? (
          <Button onClick={() => setAddOpen(true)}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={PlusSignIcon}
              strokeWidth={1.5}
            />
            {t("addDomain")}
          </Button>
        ) : null}
      </PageHeading>

      {domains.length === 0 && domainLimitReached ? (
        <p className="text-muted-foreground text-sm text-pretty">
          {tLimits("domainsHint")}
        </p>
      ) : null}

      {domains.length === 0 && !domainLimitReached ? (
        <TitleCard as="section" heading={t("connectTitle")} headingAs="h2">
          <SiteDomainAddForm
            mounts={site.mounts}
            organizationId={organizationId}
            renderActions={({ canSubmit, pending }) => (
              <div className="flex justify-end">
                <Button disabled={!canSubmit} loading={pending} type="submit">
                  {t("connectSubmit")}
                </Button>
              </div>
            )}
            siteId={siteId}
          />
        </TitleCard>
      ) : null}
      {domains.map((domain) => (
        <SiteDomainCard
          aliasOrigin={site.aliasOrigin}
          domain={domain}
          key={domain.id}
          mounts={site.mounts}
          onRemove={setRemoveTarget}
          organizationId={organizationId}
          siteId={siteId}
        />
      ))}

      <SiteDomainAddDialog
        mounts={site.mounts}
        onOpenChange={setAddOpen}
        open={addOpen}
        organizationId={organizationId}
        siteId={siteId}
      />
      <RemoveDomainDialog
        aliasOrigin={site.aliasOrigin}
        domain={removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
          }
        }}
        organizationId={organizationId}
        siteId={siteId}
      />
    </div>
  );
}
