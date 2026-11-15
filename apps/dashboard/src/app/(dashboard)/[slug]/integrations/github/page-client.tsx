"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ConnectGitHubDialog } from "@/components/integrations/github/connect-github-dialog";
import { GitHubAppSection } from "@/components/integrations/github/github-app-section";
import { GitHubRepositoriesSection } from "@/components/integrations/github/github-repositories-section";
import { SelectRepositoriesDialog } from "@/components/integrations/github/select-repositories-dialog";
import { LegacyAddIntegrationDialog } from "@/components/integrations/legacy/add-integration-dialog";
import { PageContainer } from "@/components/layout/container";
import { useGitHubSettings } from "@/hooks/use-github-settings";
import type { GitHubSettingsPageProps } from "@/types/integrations/github-settings";

export default function PageClient({
  organizationSlug,
}: GitHubSettingsPageProps) {
  const t = useTranslations("integrations.github.page");
  const tApp = useTranslations("integrations.github.appSection");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const settings = useGitHubSettings(organizationSlug);
  const {
    githubIntegrations,
    isConnected,
    handleOpenRepositories,
    handleOpenConnect,
    githubAppQuery,
    isLoading,
    isLoadingLegacyIntegrations,
  } = settings;
  const actionsDisabled = isLoading || isLoadingLegacyIntegrations;
  const showGitHubAppSection =
    actionsDisabled ||
    isConnected ||
    githubIntegrations.length > 0 ||
    (githubAppQuery.isError && !githubAppQuery.data);
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading description={t("description")} title="GitHub">
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Button
              disabled={actionsDisabled}
              onClick={
                isConnected ? () => handleOpenRepositories() : handleOpenConnect
              }
            >
              <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
              {isConnected
                ? t("addRepositories")
                : tIntegrationsShared("connectGithub")}
              <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
            </Button>
            {showGitHubAppSection ? null : (
              <Button
                disabled={actionsDisabled}
                onClick={() => settings.setLegacyOpen(true)}
                variant="outline"
              >
                {tApp("connectWithToken")}
              </Button>
            )}
          </div>
        </PageHeading>
        {showGitHubAppSection ? <GitHubAppSection {...settings} /> : null}
        <GitHubRepositoriesSection {...settings} />
      </div>
      <ConnectGitHubDialog
        isConnecting={false}
        onConnect={settings.startInstall}
        onOpenChange={settings.setConnectOpen}
        open={settings.connectOpen}
      />
      <SelectRepositoriesDialog
        accounts={settings.accounts}
        initialSelected={settings.selectedRepositoryIds}
        isLoading={
          !settings.catalogQuery.data &&
          (settings.catalogQuery.isPending || settings.catalogQuery.isFetching)
        }
        error={
          settings.catalogQuery.isError && !settings.catalogQuery.data
            ? tIntegrationsShared("unableToLoadRepositoriesFrom")
            : undefined
        }
        onRetry={() => settings.catalogQuery.refetch()}
        isSaving={settings.saveRepositoriesMutation.isPending}
        onAddAccount={settings.startInstall}
        onOpenChange={settings.setReposOpen}
        onSave={(repositoryIds) =>
          settings.saveRepositoriesMutation.mutate(repositoryIds)
        }
        onSelectAccount={settings.setSelectedDialogAccountId}
        open={settings.reposOpen}
        repositories={settings.dialogRepositories}
        selectedAccountId={settings.dialogAccountId}
      />
      <LegacyAddIntegrationDialog
        onOpenChange={settings.setLegacyOpen}
        onSuccess={() => settings.repositoriesDb.refetch()}
        open={settings.legacyOpen}
        organizationId={settings.organizationId}
        organizationSlug={organizationSlug}
      />
    </PageContainer>
  );
}
