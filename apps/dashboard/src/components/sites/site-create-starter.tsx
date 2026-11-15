"use client";

import { ArrowUpRight01Icon, FileAddIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteCreateScrollList } from "@/components/sites/site-create-scroll-list";
import {
  useCreateSiteStarter,
  useSiteStarterStatus,
} from "@/lib/hooks/use-site-starter";
import type { SiteCreateStarterProps } from "@/types/components/sites";
import { normalizeSiteStarterRoot } from "@/utils/site-starter-scope";

export function SiteCreateStarter({
  organizationId,
  repositoryId,
  branch,
  rootDirectory,
  pullRequestUrl,
  onRequestStart,
  configDirectories,
  suggestionsReady,
  suggestionsComplete,
  onRootDirectoryChange,
}: SiteCreateStarterProps) {
  const t = useTranslations("sites.new.starter");
  const scope = { organizationId, repositoryId, branch, rootDirectory };
  const status = useSiteStarterStatus(scope);
  const createStarter = useCreateSiteStarter();
  const openUrl = pullRequestUrl ?? status.data?.pullRequestUrl ?? null;

  if (
    !suggestionsReady ||
    !status.isReady ||
    !status.data ||
    status.data.hasConfig
  ) {
    return null;
  }

  const root = normalizeSiteStarterRoot(rootDirectory);
  const configPath = root ? `${root}/blog.json` : "blog.json";
  const existingRoots = [...new Set(configDirectories)].filter(
    (directory) => directory !== root
  );
  if (existingRoots.length) {
    return (
      <Alert role="status">
        <HugeiconsIcon
          aria-hidden="true"
          icon={FileAddIcon}
          strokeWidth={1.75}
        />
        <AlertTitle>{t("existingTitle")}</AlertTitle>
        <SiteCreateScrollList>
          {existingRoots.map((directory) => {
            const path = directory ? `${directory}/blog.json` : "blog.json";
            return (
              <div
                className="flex min-w-0 flex-wrap items-center justify-between gap-2"
                key={directory}
              >
                <code className="text-muted-foreground min-w-0 flex-1 text-xs [overflow-wrap:anywhere]">
                  {path}
                </code>
                <Button
                  aria-label={t("useExisting", { path })}
                  onClick={() => onRootDirectoryChange(directory)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {t("useFolder")}
                </Button>
              </div>
            );
          })}
        </SiteCreateScrollList>
      </Alert>
    );
  }
  if (!(openUrl || suggestionsComplete)) {
    return null;
  }
  return (
    <Alert role="status">
      <HugeiconsIcon aria-hidden="true" icon={FileAddIcon} strokeWidth={1.75} />
      <AlertTitle>{t(openUrl ? "opened" : "missingTitle")}</AlertTitle>
      <AlertDescription>
        {t("selectedLocation", { path: configPath, branch })}
      </AlertDescription>
      <div className="col-start-2 pt-2">
        {openUrl ? (
          <a
            className="text-muted-foreground hover:text-foreground inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md text-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            href={openUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("view")}
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5 shrink-0"
              icon={ArrowUpRight01Icon}
            />
          </a>
        ) : (
          <Button
            loading={createStarter.isPending}
            onClick={() => {
              const onOpened = onRequestStart();
              createStarter.mutate(scope, {
                onSuccess: (result) => onOpened(result.pullRequestUrl),
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("createAt")}
          </Button>
        )}
      </div>
    </Alert>
  );
}
