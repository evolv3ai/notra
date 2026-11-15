"use client";

import { Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Badge } from "@notra/ui/components/ui/badge";
import { Linear } from "@notra/ui/components/ui/svgs/linear";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useDateFnsLocale } from "@/lib/i18n/date-fns";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { LinearIntegration } from "@/types/integrations";
import dynamic from "@/utils/lazy-component";

import { LinearIntegrationDetailSkeleton } from "./skeleton";

const EditLinearIntegrationDialog = dynamic(
  () =>
    import("@/components/integrations/edit-linear-integration-dialog").then(
      (mod) => ({
        default: mod.EditLinearIntegrationDialog,
      })
    ),
  { ssr: false }
);

interface PageClientProps {
  integrationId: string;
}

export default function PageClient({ integrationId }: PageClientProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id;

  const { data, isLoading: isLoadingIntegration } = useQuery({
    ...dashboardOrpc.integrations.linear.get.queryOptions({
      input: {
        organizationId: organizationId ?? "",
        integrationId,
      },
    }),
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const integration =
    data && "id" in data ? (data as LinearIntegration) : undefined;

  if (!organizationId) {
    return null;
  }

  if (isLoadingIntegration && !integration) {
    return <LinearIntegrationDetailSkeleton />;
  }

  if (!integration) {
    return <LinearIntegrationMissing />;
  }

  return (
    <LinearIntegrationLoaded
      editDialogOpen={editDialogOpen}
      integration={integration}
      onEditOpenChange={setEditDialogOpen}
      organizationId={organizationId}
    />
  );
}

function LinearIntegrationMissing() {
  const t = useTranslations("integrations.detailPage");

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <EmptyState
          description={t("notFoundDescription")}
          title={t("notFoundTitle")}
        />
      </div>
    </PageContainer>
  );
}

function LinearIntegrationLoaded({
  editDialogOpen,
  integration,
  onEditOpenChange,
  organizationId,
}: {
  editDialogOpen: boolean;
  integration: LinearIntegration;
  onEditOpenChange: (open: boolean) => void;
  organizationId: string;
}) {
  const t = useTranslations("integrations.detailPage");
  const tCard = useTranslations("integrations.card");
  const tCommon = useTranslations("common");
  const dateFnsLocale = useDateFnsLocale();
  const formattedDate = format(new Date(integration.createdAt), "MMM d, yyyy", {
    locale: dateFnsLocale,
  });
  const createdLabel = integration.createdByUser
    ? tCard("addedBy", {
        name: integration.createdByUser.name,
        date: formattedDate,
      })
    : tCard("createdOn", { date: formattedDate });
  const statusLabel = integration.enabled
    ? tCommon("states.enabled")
    : tCommon("states.disabled");

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={
            <span className="block space-y-1">
              {integration.linearOrganizationName ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Linear className="size-4 shrink-0" />
                  <span className="min-w-0 wrap-anywhere">
                    {integration.linearOrganizationName}
                  </span>
                  {integration.linearTeamName ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="bg-muted-foreground/70 size-1 rounded-full"
                      />
                      <span className="min-w-0 wrap-anywhere">
                        {integration.linearTeamName}
                      </span>
                    </>
                  ) : null}
                </span>
              ) : null}
              <span className="block">{t("linearSubtitle")}</span>
            </span>
          }
          title={
            <span className="inline-flex max-w-full flex-wrap items-center gap-2.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="min-w-0 cursor-help wrap-anywhere">
                      {integration.displayName}
                    </span>
                  }
                />
                <TooltipContent>{createdLabel}</TooltipContent>
              </Tooltip>
              <Badge variant={integration.enabled ? "default" : "secondary"}>
                {statusLabel}
              </Badge>
            </span>
          }
        >
          <Button onClick={() => onEditOpenChange(true)} variant="outline">
            <HugeiconsIcon className="size-4" icon={Edit02Icon} />
            {tCommon("actions.edit")}
          </Button>
        </PageHeading>

        <EditLinearIntegrationDialog
          integration={integration}
          onOpenChange={onEditOpenChange}
          open={editDialogOpen}
          organizationId={organizationId}
        />

        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t("details")}</h2>
            <div className="divide-y rounded-lg border">
              {integration.linearOrganizationName ? (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm font-medium">
                    {tCommon("labels.workspace")}
                  </span>
                  <span className="text-muted-foreground min-w-0 text-right text-sm wrap-anywhere">
                    {integration.linearOrganizationName}
                  </span>
                </div>
              ) : null}
              {integration.linearTeamName ? (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm font-medium">{t("team")}</span>
                  <span className="text-muted-foreground min-w-0 text-right text-sm wrap-anywhere">
                    {integration.linearTeamName}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">
                  {tCommon("labels.status")}
                </span>
                <Badge variant={integration.enabled ? "default" : "secondary"}>
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">
                  {tCommon("labels.created")}
                </span>
                <span className="text-muted-foreground text-sm">
                  {createdLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
