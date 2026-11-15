"use client";

import {
  GEO_INGEST_DEFAULT_PACKAGE_MANAGER,
  GEO_INGEST_PACKAGE_MANAGER_OPTIONS,
} from "@notra/geo-core/constants/geo";
import type { GeoIngestPackageManager } from "@notra/geo-core/types/geo";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { CodeSnippet, CodeSnippetTabs } from "@/components/geo/code-snippet";
import { GeoPackageManagerIcon } from "@/components/geo/package-manager-icon";
import {
  AGENT_FEEDBACK_DEFAULT_SNIPPET_TAB,
  AGENT_FEEDBACK_SNIPPET_FILENAMES,
  AGENT_FEEDBACK_SNIPPET_TABS,
} from "@/constants/agent-feedback";
import { cn } from "@/lib/utils";
import type {
  AgentFeedbackSetupPanelProps,
  AgentFeedbackSetupStepProps,
  AgentFeedbackSnippetKey,
} from "@/types/agent-feedback";
import { isAgentFeedbackSnippetKey } from "@/utils/agent-feedback";
import { isGeoIngestPackageManager } from "@/utils/geo-ingest";

const PACKAGE_MANAGER_TABS = GEO_INGEST_PACKAGE_MANAGER_OPTIONS.map(
  (option) => ({
    ...option,
    icon: <GeoPackageManagerIcon manager={option.value} />,
  })
);

function SetupStep({
  step,
  title,
  description,
  last = false,
  children,
}: AgentFeedbackSetupStepProps) {
  return (
    <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
      <span
        aria-hidden
        className="border-border bg-muted text-foreground relative z-10 flex size-6 items-center justify-center rounded-full border font-mono text-xs font-medium tabular-nums"
      >
        {step}
      </span>
      {last ? null : (
        <span
          aria-hidden
          className="bg-border absolute start-3 top-7 -bottom-5 w-px"
        />
      )}
      <div className="min-w-0 space-y-2">
        <div className="space-y-0.5">
          <h3 className="text-sm leading-6 font-medium">{title}</h3>
          {description ? (
            <p className="text-muted-foreground text-xs text-pretty">
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </li>
  );
}

export function AgentFeedbackSetup({
  setup,
  className,
}: AgentFeedbackSetupPanelProps) {
  const t = useTranslations("feedback.setup");
  const tCommon = useTranslations("common");
  const [snippetKey, setSnippetKey] = useState<AgentFeedbackSnippetKey>(
    AGENT_FEEDBACK_DEFAULT_SNIPPET_TAB
  );
  const [packageManager, setPackageManager] = useState<GeoIngestPackageManager>(
    GEO_INGEST_DEFAULT_PACKAGE_MANAGER
  );
  const installCommand =
    GEO_INGEST_PACKAGE_MANAGER_OPTIONS.find(
      (option) => option.value === packageManager
    )?.command ?? GEO_INGEST_PACKAGE_MANAGER_OPTIONS[0].command;

  return (
    <ol className={cn("space-y-6", className)}>
      <SetupStep step={1} title={tCommon("labels.installThePackage")}>
        <CodeSnippet
          code={installCommand}
          tabs={
            <CodeSnippetTabs
              label={tCommon("labels.packageManager")}
              onValueChange={(value) => {
                if (isGeoIngestPackageManager(value)) {
                  setPackageManager(value);
                }
              }}
              options={PACKAGE_MANAGER_TABS}
              value={packageManager}
            />
          }
        />
      </SetupStep>
      <SetupStep
        description={t("feedbackUrlDescription")}
        step={2}
        title={t("feedbackUrl")}
      >
        {setup ? (
          <CodeSnippet
            code={setup.apiUrl}
            label={t("feedbackUrlLabel")}
            variant="command"
          />
        ) : (
          <Skeleton className="h-9 w-full rounded-lg" />
        )}
      </SetupStep>
      <SetupStep last step={3} title={t("addTool")}>
        {setup ? (
          <CodeSnippet
            code={setup.snippets[snippetKey]}
            filename={AGENT_FEEDBACK_SNIPPET_FILENAMES[snippetKey]}
            tabs={
              <CodeSnippetTabs
                label={t("snippet")}
                onValueChange={(value) => {
                  if (isAgentFeedbackSnippetKey(value)) {
                    setSnippetKey(value);
                  }
                }}
                options={AGENT_FEEDBACK_SNIPPET_TABS.map((item) => ({
                  value: item.value,
                  label: t(`snippetTabs.${item.value}`),
                }))}
                value={snippetKey}
              />
            }
          />
        ) : (
          <Skeleton className="h-44 w-full rounded-lg" />
        )}
      </SetupStep>
    </ol>
  );
}
