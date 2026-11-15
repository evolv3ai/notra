import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { GitHubRepositoriesSkeleton } from "@/app/(dashboard)/[slug]/integrations/github/skeleton";
import { Button } from "@/components/button";
import { GitHubRepositoryPreview } from "@/components/integrations/github/github-repository-preview";
import { GitHubRepositoryRow } from "@/components/integrations/github/github-repository-row";
import { useRepositoryHashScroll } from "@/hooks/use-repository-hash-scroll";
import type { GitHubRepositoriesSectionProps } from "@/types/integrations/github-settings";

function RepositoryList({
  githubIntegrations,
  organizationId,
  isLoadingLegacyIntegrations,
  repositoriesDb,
  handleOpenRepositories,
  handleOpenConnect,
  isConnected,
  migrationMutation,
}: GitHubRepositoriesSectionProps) {
  const t = useTranslations("integrations.github");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const tCommon = useTranslations("common");

  if (isLoadingLegacyIntegrations) {
    return <GitHubRepositoriesSkeleton />;
  }
  if (repositoriesDb.isError && !repositoriesDb.hasData) {
    return (
      <div
        role="alert"
        className="border-destructive/50 bg-destructive/10 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-destructive text-sm">
          {t("repositoriesSection.loadFailed")}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => repositoriesDb.refetch()}
        >
          {tCommon("actions.retry")}
        </Button>
      </div>
    );
  }
  if (githubIntegrations.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center sm:py-14">
        <GitHubRepositoryPreview />
        <h3 className="mt-2 text-lg font-semibold tracking-tight">
          {t("repositoriesSection.emptyTitle")}
        </h3>
        <Button
          className="mt-5"
          variant="outline"
          onClick={
            isConnected ? () => handleOpenRepositories() : handleOpenConnect
          }
        >
          <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
          {isConnected
            ? t("page.addRepositories")
            : tIntegrationsShared("connectGithub")}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {githubIntegrations.map((integration) => (
        <GitHubRepositoryRow
          integration={integration}
          key={integration.id}
          organizationId={organizationId}
          onManageRepositories={() => handleOpenRepositories()}
          onMigrate={(target) => migrationMutation.mutate(target)}
          isMigrating={
            migrationMutation.isPending &&
            migrationMutation.variables?.id === integration.id
          }
        />
      ))}
    </div>
  );
}

export function GitHubRepositoriesSection(
  props: GitHubRepositoriesSectionProps
) {
  const t = useTranslations("integrations.github.repositoriesSection");
  const tCommon = useTranslations("common");
  const { githubIntegrations, repositoriesDb } = props;
  useRepositoryHashScroll(githubIntegrations);
  return (
    <section
      aria-labelledby="github-repositories-heading"
      className="min-w-0 space-y-4"
    >
      <h2 className="sr-only" id="github-repositories-heading">
        {tCommon("labels.repositories")} ({githubIntegrations.length})
      </h2>
      {repositoriesDb.isError && repositoriesDb.hasData ? (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-destructive text-sm">{t("refreshFailed")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => repositoriesDb.refetch()}
          >
            {tCommon("actions.retry")}
          </Button>
        </div>
      ) : null}
      <RepositoryList {...props} />
    </section>
  );
}
