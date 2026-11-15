import type {
  AiTrafficResponse,
  WebAnalyticsResponse,
} from "@notra/geo-core/types/geo";
import {
  trafficDayKey,
  trafficSparklineDays,
} from "@notra/geo-core/utils/ai-traffic";
import { tableDataToCsv } from "@notra/ui/lib/message-table";
import type { MessageTableData } from "@notra/ui/types/message-table";

import type { GeoRangeQuery } from "@/types/geo";
import { downloadBlob, sanitizeDownloadFilename } from "@/utils/download";

/** One row per day: human views and visitors, AI agent and AI referral visits. */
function trafficCsvTable(
  web: WebAnalyticsResponse | undefined,
  traffic: AiTrafficResponse | undefined,
  from?: string,
  to?: string
): MessageTableData {
  const webDays = new Map(
    (web?.points ?? []).map((point) => [trafficDayKey(point.day), point])
  );
  const agents = new Map<string, number>();
  const referrals = new Map<string, number>();
  for (const point of traffic?.points ?? []) {
    let counts: Map<string, number>;
    if (point.visitorType === "crawler") {
      counts = agents;
    } else if (point.visitorType === "ai_referral") {
      counts = referrals;
    } else {
      continue;
    }
    const day = trafficDayKey(point.day);
    counts.set(day, (counts.get(day) ?? 0) + point.visits);
  }
  const days = trafficSparklineDays(
    [
      ...(from ? [{ day: from }] : []),
      ...(web?.points ?? []),
      ...(traffic?.points ?? []),
    ],
    from,
    to
  );
  return {
    headers: [
      "date",
      "human_views",
      "human_visitors",
      "ai_agent_visits",
      "ai_referral_visits",
    ],
    rows: days.map((day) => [
      day,
      String(webDays.get(day)?.views ?? 0),
      String(webDays.get(day)?.visitors ?? 0),
      String(agents.get(day) ?? 0),
      String(referrals.get(day) ?? 0),
    ]),
  };
}

function trafficCsvFilename(from?: string, to?: string, path = "") {
  const page = path.replaceAll("/", " ").trim().replaceAll(" ", "-");
  const parts = ["traffic", from, to, page].filter(Boolean);
  return `${sanitizeDownloadFilename(parts.join("-")) || "traffic"}.csv`;
}

export function downloadTrafficCsv(
  traffic: AiTrafficResponse,
  web: WebAnalyticsResponse,
  range: GeoRangeQuery,
  path: string
) {
  const csv = tableDataToCsv(
    trafficCsvTable(web, traffic, range.from, range.to)
  );
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    trafficCsvFilename(range.from, range.to, path)
  );
}
