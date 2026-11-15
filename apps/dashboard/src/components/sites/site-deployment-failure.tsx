"use client";

import {
  Alert02Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { CopyPromptButton } from "@/components/geo/code-snippet";
import { cn } from "@/lib/utils";
import type {
  SiteDeploymentFailureProps,
  SiteDiagnosticItemProps,
  SiteFailureBodyProps,
  SiteFailureChipProps,
} from "@/types/components/sites";
import { buildSiteBuildAgentPrompt } from "@/utils/site-build-agent-prompt";
import {
  siteDiagnosticLocation,
  sortSiteDiagnostics,
  withDiagnosticKeys,
} from "@/utils/site-diagnostics";

function SiteDiagnosticItem({ diagnostic, failed }: SiteDiagnosticItemProps) {
  const tDiagnostics = useTranslations("sites.diagnostics");
  const where = siteDiagnosticLocation(diagnostic);
  const isError = diagnostic.severity === "error";
  const severity = isError ? tDiagnostics("error") : tDiagnostics("warning");

  return (
    <li className="min-w-0">
      <p className="text-foreground text-pretty">
        <span className="sr-only">{severity}: </span>
        {diagnostic.message}
      </p>
      <p className="text-muted-foreground flex min-w-0 flex-wrap gap-x-3 font-mono text-xs">
        {isError !== failed ? (
          <span
            aria-hidden="true"
            className={isError ? "text-destructive" : "text-warning"}
          >
            {severity}
          </span>
        ) : null}
        {where ? (
          <span className="[overflow-wrap:anywhere]">{where}</span>
        ) : null}
        <span>{diagnostic.code}</span>
      </p>
    </li>
  );
}

function SiteFailureChip({ failed }: SiteFailureChipProps) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-lg [corner-shape:squircle] [&_svg]:size-3.5",
        failed
          ? "bg-destructive/12 text-destructive dark:bg-[oklch(0.7_0.16_25/0.15)] dark:text-[oklch(0.7_0.16_25)]"
          : "bg-warning/12 text-warning"
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        icon={failed ? MultiplicationSignCircleIcon : Alert02Icon}
        strokeWidth={2}
      />
    </span>
  );
}

function SiteFailureBody({
  errorMessage,
  diagnostics,
  failed,
}: SiteFailureBodyProps) {
  const t = useTranslations("sites.deploymentPage");
  const showMessage =
    failed && Boolean(errorMessage) && diagnostics.length === 0;
  if (!showMessage && diagnostics.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {showMessage ? (
        <p className="text-muted-foreground font-mono text-xs leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap">
          {errorMessage}
        </p>
      ) : null}
      {diagnostics.length > 0 ? (
        <ul aria-label={t("diagnostics.title")} className="space-y-2">
          {diagnostics.map(({ diagnostic, key }) => (
            <SiteDiagnosticItem
              diagnostic={diagnostic}
              failed={failed}
              key={key}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SiteDeploymentFailure({
  deployment,
  site,
  log,
}: SiteDeploymentFailureProps) {
  const t = useTranslations("sites.deploymentPage");
  const failed = deployment.status === "failed";
  if (!failed && deployment.diagnostics.length === 0) {
    return null;
  }
  const title = failed ? t("notice.failed") : t("diagnostics.title");

  return (
    <section
      aria-label={title}
      className={cn(
        "group/failure border-border bg-background from-background to-muted/60 flex items-start gap-2.5 rounded-[0.875rem] border bg-linear-to-b p-3 text-sm [corner-shape:squircle]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.06)]",
        "dark:border-input dark:bg-muted dark:from-input dark:to-muted dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.4)]"
      )}
      data-tone={failed ? "error" : "warning"}
      role={failed ? "alert" : "status"}
    >
      <SiteFailureChip failed={failed} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
          <span className="leading-snug font-medium">{title}</span>
          {failed ? (
            <div className="ms-auto shrink-0">
              <CopyPromptButton
                prompt={buildSiteBuildAgentPrompt({ site, deployment, log })}
              />
            </div>
          ) : null}
        </div>
        <SiteFailureBody
          diagnostics={withDiagnosticKeys(
            sortSiteDiagnostics(deployment.diagnostics)
          )}
          errorMessage={deployment.errorMessage}
          failed={failed}
        />
      </div>
    </section>
  );
}
