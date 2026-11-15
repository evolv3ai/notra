"use client";

import { FileExportIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_FILTER_TRIGGER_CLASS } from "@notra/geo-core/constants/geo";
import { useTranslations } from "use-intl";

import type { TrafficExportButtonProps } from "@/types/geo";
import { downloadTrafficCsv } from "@/utils/traffic-export";

export function TrafficExportButton({
  traffic,
  web,
  range,
  path,
}: TrafficExportButtonProps) {
  const t = useTranslations("geo.trafficExport");
  const disabled = traffic === undefined || web === undefined;

  return (
    <button
      className={`${GEO_FILTER_TRIGGER_CLASS} disabled:pointer-events-none disabled:opacity-50`}
      disabled={disabled}
      onClick={() => {
        if (traffic && web) {
          downloadTrafficCsv(traffic, web, range, path);
        }
      }}
      type="button"
    >
      <HugeiconsIcon
        className="text-muted-foreground"
        icon={FileExportIcon}
        size={12}
      />
      {t("label")}
    </button>
  );
}
