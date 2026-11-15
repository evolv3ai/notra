"use client";

import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { EmptyStateTablePreview } from "@/components/empty-state-preview";
import {
  EMPTY_STATE_TABLE_COLUMNS,
  EMPTY_STATE_TABLE_ROWS,
} from "@/constants/empty-state";
import { TRAFFIC_PATH_WIDEN_MAX_DAYS } from "@/constants/traffic-path";
import { useTrafficPathQuery } from "@/lib/hooks/use-traffic-path";
import type { TrafficPathEmptyProps } from "@/types/geo";

export function TrafficPathEmpty({ geoRange }: TrafficPathEmptyProps) {
  const t = useTranslations("geo.pages.traffic");
  const [path, setPath] = useTrafficPathQuery();
  const canWiden = geoRange.days <= TRAFFIC_PATH_WIDEN_MAX_DAYS;

  return (
    <EmptyState
      action={
        <>
          <Button onClick={() => setPath("")}>{t("emptyPathReset")}</Button>
          {canWiden ? (
            <Button onClick={() => geoRange.setPreset("90d")} variant="outline">
              {t("emptyPathWiden")}
            </Button>
          ) : null}
        </>
      }
      description={t("emptyPathDescription")}
      preview={
        <EmptyStateTablePreview
          columns={EMPTY_STATE_TABLE_COLUMNS.traffic}
          rows={EMPTY_STATE_TABLE_ROWS}
        />
      }
      title={t("emptyPathTitle", { path })}
    />
  );
}
