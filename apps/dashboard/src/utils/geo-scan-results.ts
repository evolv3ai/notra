import type { GeoSettingsResponse } from "@notra/geo-core/types/geo";
import type { QueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { GeoQueryScope } from "@/types/geo";

export async function invalidateGeoScanResultQueries(
  queryClient: QueryClient,
  input: GeoQueryScope
) {
  await Promise.all(
    [
      dashboardOrpc.geo.sentiment.key({ input }),
      dashboardOrpc.geo.sentimentEvidence.key({ input }),
      dashboardOrpc.geo.sentimentAnalysis.key({ input }),
      dashboardOrpc.geo.scanRuns.key({ input }),
      dashboardOrpc.geo.scanRun.key({ input }),
      dashboardOrpc.geo.overview.key({ input }),
      dashboardOrpc.geo.timeseries.key({ input }),
      dashboardOrpc.geo.promptResultSummaries.key({ input }),
      dashboardOrpc.geo.changes.key({ input }),
      dashboardOrpc.geo.promptHistory.key({ input }),
      dashboardOrpc.geo.competitorShare.key({ input }),
      dashboardOrpc.geo.competitorEngineMatrix.key({ input }),
      dashboardOrpc.geo.competitorDetail.key({ input }),
      dashboardOrpc.geo.languageShare.key({ input }),
      dashboardOrpc.geo.sequenceResults.key({ input }),
      dashboardOrpc.geo.personaResults.key({ input }),
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

export async function refreshSettingsAfterScanStart(
  queryClient: QueryClient,
  organizationId: string,
  projectId: string | undefined
) {
  const settingsKey = dashboardOrpc.geo.settings.queryKey({
    input: { organizationId, projectId },
  });
  await queryClient.invalidateQueries({ queryKey: settingsKey });
  const settings = queryClient.getQueryData<GeoSettingsResponse>(settingsKey);
  if (!settings?.settings?.isScanning) {
    await invalidateGeoScanResultQueries(queryClient, {
      organizationId,
      projectId,
    });
  }
}
