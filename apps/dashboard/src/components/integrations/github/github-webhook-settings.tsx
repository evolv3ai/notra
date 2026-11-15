"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import { GitHubWebhookCredentials } from "@/components/integrations/github/github-webhook-credentials";
import { GitHubWebhookRepairDialog } from "@/components/integrations/github/github-webhook-repair-dialog";
import { GitHubWebhookRotationDialog } from "@/components/integrations/github/github-webhook-rotation-dialog";
import type { GitHubWebhookSettingsProps } from "@/types/integrations/github";
import { isNotFoundError } from "@/utils/orpc-errors";

export function GitHubWebhookSettings({
  repository,
  webhook: controller,
}: GitHubWebhookSettingsProps) {
  const t = useTranslations("integrations.github.webhookSettings");
  const tCommon = useTranslations("common");
  const headingId = useId();
  const { action, close, config, generate, repair, rotate } = controller;
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      close();
    }
  };

  const webhook = config.data;
  const configurationError =
    !config.isPending &&
    !webhook &&
    config.error &&
    !isNotFoundError(config.error)
      ? config.error
      : null;
  return (
    <>
      <ResponsiveDialog
        open={action === "setup"}
        onOpenChange={handleOpenChange}
      >
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle id={headingId} className="break-words">
              {t("title")}
              <span className="text-muted-foreground font-normal">
                {" "}
                · {repository.owner}/{repository.repo}
              </span>
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("description")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <section
            aria-labelledby={headingId}
            aria-busy={config.isPending}
            className="min-w-0"
          >
            {config.isPending && (
              <div className="grid gap-3 sm:grid-cols-2">
                {["url", "secret"].map((id) => (
                  <div key={id} aria-hidden="true" className="space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
                <span className="sr-only" role="status">
                  {t("loading")}
                </span>
              </div>
            )}
            {configurationError && (
              <div
                className="border-destructive/30 flex min-h-10 items-center justify-between gap-3 rounded-lg border px-3"
                role="alert"
              >
                <p className="text-destructive text-sm">
                  {configurationError.message}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={config.isFetching}
                  onClick={() => config.refetch()}
                >
                  {tCommon("actions.retry")}
                </Button>
              </div>
            )}
            {!config.isPending && !webhook && !configurationError && (
              <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
                <p className="text-muted-foreground text-sm">
                  {t("notConfigured")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  loading={generate.isPending}
                  disabled={repair.isPending}
                  onClick={() => generate.mutate()}
                >
                  {t("generate")}
                </Button>
              </div>
            )}
            {!config.isPending && webhook && (
              <GitHubWebhookCredentials webhook={webhook} />
            )}
          </section>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose
              disabled={generate.isPending}
              render={<Button type="button" variant="ghost" />}
            >
              {tCommon("actions.close")}
            </ResponsiveDialogClose>
            <a
              className={buttonVariants({ variant: "outline" })}
              href={`https://github.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/settings/hooks`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("openGitHub")}
              <HugeiconsIcon
                aria-hidden="true"
                icon={ArrowUpRight01Icon}
                data-icon="inline-end"
              />
            </a>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      <GitHubWebhookRepairDialog
        open={action === "repair"}
        onOpenChange={handleOpenChange}
        onConfirm={() => repair.mutate()}
        isPending={repair.isPending}
        disabled={generate.isPending}
        error={repair.error}
      />
      <GitHubWebhookRotationDialog
        open={action === "rotate"}
        onOpenChange={handleOpenChange}
        isPending={generate.isPending}
        onConfirm={rotate}
      />
    </>
  );
}
