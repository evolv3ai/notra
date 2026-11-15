import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Progress } from "@notra/ui/components/ui/progress";
import { useLocale, useTranslations } from "use-intl";

import type { GeoScanActivityStatusProps } from "@/types/geo-scan-activity";
import { geoRunProgress } from "@/utils/geo-scan-activity";

/** One line above the answers table while a scan is starting or running. */
export function ScanActivityStatus({
  run,
  starting,
}: GeoScanActivityStatusProps) {
  const t = useTranslations("geo.scanActivityStatus");
  const locale = useLocale();
  if (run.status === "running") {
    const total = run.plan?.totalChecks ?? null;
    return (
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <span className="text-foreground inline-flex shrink-0 items-center gap-2 font-medium">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-primary motion-safe:animate-spin"
            icon={Loading03Icon}
            size={14}
          />
          {t("running")}
        </span>
        {total ? (
          <>
            <Progress
              aria-label={t("progressLabel")}
              className="w-32 shrink-0"
              value={geoRunProgress(run)}
            />
            <span className="text-muted-foreground truncate tabular-nums">
              {t("answered", {
                checks: run.checks.toLocaleString(locale),
                total: total.toLocaleString(locale),
              })}
            </span>
          </>
        ) : null}
      </div>
    );
  }
  if (starting) {
    return (
      <p className="text-foreground inline-flex min-w-0 items-center gap-2 text-sm font-medium">
        <HugeiconsIcon
          aria-hidden="true"
          className="text-primary shrink-0 motion-safe:animate-spin"
          icon={Loading03Icon}
          size={14}
        />
        {t("starting")}
      </p>
    );
  }
  return null;
}
