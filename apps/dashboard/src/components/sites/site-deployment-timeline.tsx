"use client";

import { Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useLocale, useTranslations } from "use-intl";

import { useFrameNow } from "@/lib/hooks/use-frame-now";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";
import type { SiteDeploymentTimelineProps } from "@/types/components/sites";
import {
  deploymentTimelinePhases,
  formatDeploymentPhaseDuration,
} from "@/utils/site-deployment-timeline";
import { isDeploymentInProgress } from "@/utils/site-deployments";

export function SiteDeploymentTimeline({
  deployment,
  log,
}: SiteDeploymentTimelineProps) {
  const t = useTranslations("sites.deploymentPage.timeline");
  const locale = useLocale();
  const running = isDeploymentInProgress(deployment.status);
  const now = useNow(running);
  const frameNow = useFrameNow(running);
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    [locale]
  );
  const frameGrowth = Math.max(0, frameNow - now);
  const phases = useMemo(
    () =>
      deploymentTimelinePhases(deployment, log, now).map((phase) => ({
        ...phase,
        duration: formatDeploymentPhaseDuration(phase.durationMs, locale),
        startIso:
          phase.startedAt !== null
            ? new Date(phase.startedAt).toISOString()
            : null,
        startLabel:
          phase.startedAt !== null ? time.format(phase.startedAt) : null,
      })),
    [deployment, log, now, locale, time]
  );

  const timed = phases.filter((phase) => phase.state !== "pending");
  const totalMs =
    timed.length > 0 && timed.every((phase) => phase.durationMs !== null)
      ? timed.reduce((sum, phase) => sum + (phase.durationMs ?? 0), 0)
      : null;
  const total = formatDeploymentPhaseDuration(totalMs, locale);

  return (
    <section aria-label={t("title")} className="space-y-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{t("title")}</h2>
        {total ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("total", { duration: total })}
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-xl gap-1.5">
          {phases.map((phase) => {
            const duration = phase.duration;
            const label = t(`phases.${phase.id}`);
            const state = t(`states.${phase.state}`);
            let icon = null;
            if (phase.state === "active") {
              icon = Loading03Icon;
            } else if (phase.state === "failed" || phase.state === "stopped") {
              icon = Cancel01Icon;
            }
            return (
              <li
                aria-current={phase.state === "active" ? "step" : undefined}
                aria-label={`${label} · ${state}${duration ? ` · ${duration}` : ""}`}
                className="@container/phase min-w-24 grow-(--phase-duration) basis-0 space-y-1.5"
                data-phase={phase.id}
                data-state={phase.state}
                key={phase.id}
                style={
                  {
                    "--phase-duration": Math.max(
                      (phase.durationMs ?? 0) +
                        (phase.state === "active" && phase.durationMs !== null
                          ? frameGrowth
                          : 0),
                      1
                    ),
                  } as CSSProperties
                }
              >
                <div className="flex min-w-0 items-center gap-1.5 text-xs">
                  {icon ? (
                    <HugeiconsIcon
                      aria-hidden="true"
                      className={cn(
                        "size-3.5 shrink-0",
                        phase.state === "active" &&
                          "text-warning motion-safe:animate-spin",
                        phase.state === "failed" && "text-destructive",
                        phase.state === "stopped" && "text-warning"
                      )}
                      icon={icon}
                      strokeWidth={1.75}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      phase.state === "pending" || phase.state === "unknown"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    )}
                    title={label}
                  >
                    {phase.id === "preparing" ? (
                      <>
                        <span className="@min-[8rem]/phase:hidden">
                          {t("phases.preparingShort")}
                        </span>
                        <span className="hidden @min-[8rem]/phase:inline">
                          {label}
                        </span>
                      </>
                    ) : (
                      label
                    )}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-muted-foreground relative isolate flex h-7 items-center justify-end overflow-hidden rounded-md border border-dashed px-2 font-mono text-xs tabular-nums",
                    phase.state === "complete" &&
                      "border-geo-up/25 bg-geo-up/10 text-geo-up border-solid",
                    phase.state === "active" &&
                      "border-warning/30 bg-warning/10 text-warning border-solid before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[repeating-linear-gradient(135deg,currentColor_0px,currentColor_3px,transparent_3px,transparent_8px)] before:opacity-15",
                    phase.state === "stopped" &&
                      "border-warning/25 bg-warning/5 text-warning border-solid",
                    phase.state === "failed" &&
                      "border-destructive/35 bg-destructive/10 text-destructive border-solid"
                  )}
                  title={duration ?? t("timingUnavailable")}
                >
                  {duration ?? "–"}
                </div>
                <div className="text-muted-foreground/70 min-h-4 font-mono text-xs tabular-nums">
                  {phase.startIso !== null ? (
                    <time
                      dateTime={phase.startIso}
                      suppressHydrationWarning
                      title={phase.startIso}
                    >
                      {phase.startLabel}
                    </time>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
