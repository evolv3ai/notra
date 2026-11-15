"use client";

import { Github } from "@notra/ui/components/ui/svgs/github";
import { Switch } from "@notra/ui/components/ui/switch";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useGitHubRepositoryActions } from "@/hooks/use-github-repository-actions";
import { useGitHubWebhookActions } from "@/hooks/use-github-webhook-actions";
import type {
  GitHubPublishingEditor,
  GitHubRepositoryRowProps,
} from "@/types/integrations/github";

import { GitHubBranchPicker } from "./github-branch-picker";
import { GitHubPublishingSettings } from "./github-publishing-settings";
import { GitHubRepositoryActions } from "./github-repository-actions";
import { GitHubSettingRow } from "./github-setting-row";
import { GitHubWebhookSettings } from "./github-webhook-settings";

export function GitHubRepositoryRow({
  integration,
  organizationId,
  onMigrate,
  isMigrating,
  onManageRepositories,
}: GitHubRepositoryRowProps) {
  const t = useTranslations("integrations.github.repositoryRow");
  const tWebhook = useTranslations("integrations.github.webhookSettings");
  const tCommon = useTranslations("common");
  const headingId = useId();
  const statusSwitchId = useId();
  const [openEditor, setOpenEditor] = useState<GitHubPublishingEditor | null>(
    null
  );
  const { isEnabled, toggle } = useGitHubRepositoryActions({
    integration,
    organizationId,
  });
  const legacy = !integration.managedByGitHubApp;
  const primaryRepository = integration.repositories[0];
  const webhookRepository = legacy ? primaryRepository : undefined;
  const webhook = useGitHubWebhookActions({
    organizationId,
    repository: webhookRepository,
  });
  const multipleRepositories = integration.repositories.length > 1;
  return (
    <article
      aria-labelledby={headingId}
      className="min-w-0 scroll-mt-24"
      id={`repository-${integration.id}`}
    >
      <TitleCard
        action={
          <GitHubRepositoryActions
            onMigrate={() => onMigrate(integration)}
            isMigrating={isMigrating}
            webhook={webhookRepository ? webhook : null}
            integration={integration}
            organizationId={organizationId}
            onManageRepositories={onManageRepositories}
          />
        }
        contentClassName="divide-border divide-y p-0"
        heading={
          <h3
            className="truncate text-sm"
            id={headingId}
            title={
              primaryRepository
                ? `${primaryRepository.owner}/${primaryRepository.repo}`
                : integration.displayName
            }
          >
            {primaryRepository ? (
              <a
                className="underline-offset-4 hover:underline"
                href={`https://github.com/${encodeURIComponent(primaryRepository.owner)}/${encodeURIComponent(primaryRepository.repo)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-muted-foreground font-normal">
                  {primaryRepository.owner}/
                </span>
                {primaryRepository.repo}
              </a>
            ) : (
              integration.displayName
            )}
          </h3>
        }
        headingAs="div"
        icon={<Github />}
      >
        <GitHubSettingRow
          htmlFor={statusSwitchId}
          title={t("statusTitle")}
          description={isEnabled ? t("statusActive") : t("statusPaused")}
        >
          <Switch
            id={statusSwitchId}
            aria-label={
              isEnabled
                ? tCommon("labels.pauseName", { name: integration.displayName })
                : tCommon("labels.enableName", {
                    name: integration.displayName,
                  })
            }
            checked={isEnabled}
            onCheckedChange={toggle}
          />
        </GitHubSettingRow>
        {integration.repositories.map((repository) => (
          <div className="divide-border min-w-0 divide-y" key={repository.id}>
            {multipleRepositories ? (
              <h4
                className="bg-muted/40 text-muted-foreground truncate px-4 py-2 text-xs font-medium"
                title={`${repository.owner}/${repository.repo}`}
              >
                {repository.owner}/{repository.repo}
              </h4>
            ) : null}
            <GitHubSettingRow
              title={t("branchTitle")}
              description={t("branchDescription")}
            >
              <GitHubBranchPicker
                organizationId={organizationId}
                repository={repository}
              />
            </GitHubSettingRow>
            <GitHubPublishingSettings
              repository={repository}
              organizationId={organizationId}
              disabled={!integration.enabled || !repository.enabled}
              openEditor={openEditor}
              onOpenEditorChange={setOpenEditor}
            />
          </div>
        ))}
        {integration.repositories.length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">
            {t("noRepository")}
          </p>
        ) : null}
        {webhookRepository && webhookRepository.hasWebhook !== undefined ? (
          <GitHubSettingRow
            title={tWebhook("title")}
            description={
              webhookRepository.hasWebhook
                ? tWebhook("rowConfigured")
                : tWebhook("rowNotConfigured")
            }
          >
            <Button
              disabled={webhook.busy}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => webhook.open("setup")}
            >
              {webhookRepository.hasWebhook
                ? tWebhook("view")
                : tWebhook("setUp")}
            </Button>
          </GitHubSettingRow>
        ) : null}
      </TitleCard>
      {webhookRepository ? (
        <GitHubWebhookSettings
          repository={webhookRepository}
          webhook={webhook}
        />
      ) : null}
    </article>
  );
}
