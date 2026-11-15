import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

import { GitHubIntegrationSkeleton } from "@/app/(dashboard)/[slug]/integrations/github/skeleton";
import { Button } from "@/components/button";
import { GitHubAccountCard } from "@/components/integrations/github/github-account-card";
import { GitHubSettingRow } from "@/components/integrations/github/github-setting-row";
import type { GitHubAppSectionProps } from "@/types/integrations/github-settings";

function GitHubAccounts({
  githubAppQuery,
  isLoading,
  isLoadingLegacyIntegrations,
  isConnected,
  accounts,
  repositories,
  selectedRepositoryIds,
  disconnectMutation,
  handleOpenRepositories,
  handleOpenConnect,
}: GitHubAppSectionProps) {
  const t = useTranslations("integrations.github.appSection");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const tCommon = useTranslations("common");

  if (githubAppQuery.isError && !githubAppQuery.data) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-muted-foreground text-sm">{t("loadFailed")}</p>
        <Button
          disabled={githubAppQuery.isFetching}
          variant="outline"
          size="sm"
          onClick={() => githubAppQuery.refetch()}
        >
          {githubAppQuery.isFetching
            ? tCommon("labels.retrying")
            : tCommon("actions.retry")}
        </Button>
      </div>
    );
  }
  if (isLoading) {
    return <GitHubIntegrationSkeleton />;
  }
  if (isConnected) {
    return (
      <section
        aria-label={t("connectedAccounts")}
        className="divide-border divide-y"
      >
        {accounts.map((account) => (
          <GitHubAccountCard
            account={account}
            key={account.id}
            isDisconnecting={disconnectMutation.isPending}
            onAddRepositories={() => handleOpenRepositories(account.id)}
            onDisconnect={() => disconnectMutation.mutate(account.id)}
            repositories={repositories.filter(
              (repository) =>
                repository.owner.toLowerCase() === account.login.toLowerCase()
            )}
            selectedRepositoryIds={selectedRepositoryIds}
          />
        ))}
      </section>
    );
  }
  if (isLoadingLegacyIntegrations) {
    return <GitHubIntegrationSkeleton />;
  }
  return (
    <GitHubSettingRow
      title={t("connectTitle")}
      description={t("connectDescription")}
    >
      <Button variant="outline" size="sm" onClick={handleOpenConnect}>
        {tIntegrationsShared("connectGithub")}
      </Button>
    </GitHubSettingRow>
  );
}

export function GitHubAppSection(props: GitHubAppSectionProps) {
  const t = useTranslations("integrations.github.appSection");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const { isConnected, handleOpenConnect, setLegacyOpen } = props;
  return (
    <TitleCard
      action={
        isConnected ? (
          <Button variant="outline" size="sm" onClick={handleOpenConnect}>
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            {tIntegrationsShared("addGithubAccount")}
          </Button>
        ) : null
      }
      aria-labelledby="github-app-heading"
      as="section"
      className="min-w-0"
      contentClassName="divide-border divide-y p-0"
      heading={<span id="github-app-heading">{t("title")}</span>}
      headingAs="h2"
    >
      <GitHubAccounts {...props} />
      <GitHubSettingRow
        title={t("tokenTitle")}
        description={t("tokenDescription")}
      >
        <Button
          disabled={props.isLoading || props.isLoadingLegacyIntegrations}
          variant="outline"
          size="sm"
          onClick={() => setLegacyOpen(true)}
        >
          {t("connectWithToken")}
        </Button>
      </GitHubSettingRow>
    </TitleCard>
  );
}
