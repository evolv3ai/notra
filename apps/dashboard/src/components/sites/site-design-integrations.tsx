"use client";

import { Alert02Icon, Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  c15tSchema,
  siteIntegrationSchemas,
} from "@notra/sites-core/schemas/site-integrations";
import type { SiteIntegrationName } from "@notra/sites-core/types/site-integrations";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteConsentSection } from "@/components/sites/site-consent-section";
import { SiteIntegrationDialog } from "@/components/sites/site-integration-dialog";
import { SiteIntegrationRow } from "@/components/sites/site-integration-row";
import {
  SiteSettingsGroup,
  SiteSettingsList,
} from "@/components/sites/site-settings-item";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { SITE_INTEGRATION_PROVIDERS } from "@/constants/site-integrations";
import {
  useSaveSiteIntegration,
  useSiteIntegrations,
} from "@/lib/hooks/use-site-integrations";
import { toErrorMessage } from "@/utils/error-message";
import { siteIntegrationSettings } from "@/utils/site-integrations";

/** Integrations live in blog.json, so they save as drafts on the branch the Design tab is editing. */
export function SiteDesignIntegrations() {
  const t = useTranslations("sites.integrationsPage");
  const state = useSiteWorkspace()!;
  const scope = state.scope;
  const query = useSiteIntegrations(scope);
  const save = useSaveSiteIntegration(scope);
  const [openId, setOpenId] = useState<SiteIntegrationName | null>(null);
  const flush = state.saves.flush;
  // Integration saves write blog.json on the server; pending design edits must land first.
  useEffect(() => {
    void flush().catch(() => undefined);
  }, [flush]);
  const busy = state.saves.unsaved || save.isPending;
  const consentSetUp = c15tSchema.safeParse(
    query.data?.integrations.c15t
  ).success;
  const open = SITE_INTEGRATION_PROVIDERS.find(
    (provider) => provider.id === openId
  );

  return (
    <div className="space-y-8">
      {query.isError ? (
        <Alert>
          <HugeiconsIcon
            aria-hidden="true"
            icon={Alert02Icon}
            strokeWidth={1.5}
          />
          <AlertTitle>{t("loadFailed")}</AlertTitle>
          <AlertDescription>
            <p>{t("loadFailedDescription")}</p>
            <Button
              disabled={query.isFetching}
              onClick={() => query.refetch()}
              size="sm"
              variant="outline"
            >
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {query.data?.invalid ? (
        <Alert variant="warning">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Alert02Icon}
            strokeWidth={1.5}
          />
          <AlertTitle>{t("invalidTitle")}</AlertTitle>
          <AlertDescription>{t("invalidDescription")}</AlertDescription>
        </Alert>
      ) : null}

      <SiteSettingsGroup icon={Analytics01Icon} title={t("analyticsTitle")}>
        <SiteSettingsList>
          {SITE_INTEGRATION_PROVIDERS.map((provider) => (
            <SiteIntegrationRow
              description={t(`providers.${provider.id}`)}
              loading={query.isPending}
              isSetUp={
                siteIntegrationSchemas[provider.id].safeParse(
                  query.data?.integrations[provider.id]
                ).success
              }
              disabled={query.isError || busy}
              key={provider.id}
              onOpen={() => setOpenId(provider.id)}
              onRemove={() =>
                save.mutate(
                  { provider: provider.id, settings: null },
                  {
                    onSuccess: () =>
                      toast.success(t("removed"), {
                        description: t("savedDescription"),
                      }),
                    onError: (error) =>
                      toast.error(toErrorMessage(error, t("saveFailed"))),
                  }
                )
              }
              provider={provider}
            />
          ))}
        </SiteSettingsList>
      </SiteSettingsGroup>

      <SiteConsentSection
        branch={scope.branch}
        disabled={query.isPending || query.isError || busy}
        isSetUp={consentSetUp}
        loading={query.isPending}
      />

      {open ? (
        <SiteIntegrationDialog
          key={`${scope.siteId}:${scope.branch ?? ""}:${open.id}`}
          onOpenChange={(next) => {
            if (!next) {
              setOpenId(null);
            }
          }}
          open
          provider={open}
          scope={scope}
          settings={siteIntegrationSettings(query.data?.integrations, open)}
        />
      ) : null}
    </div>
  );
}
