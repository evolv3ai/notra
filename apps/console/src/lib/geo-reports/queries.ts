import "server-only";
import { db } from "@notra/db/drizzle";
import { geoProspectReports } from "@notra/db/schema";
import { and, desc, eq } from "drizzle-orm";

import type { GeoReport, GeoReportListItem } from "@/types/geo-report";

export async function listGeoReports(
  organizationId: string
): Promise<GeoReportListItem[]> {
  const rows = await db
    .select({
      id: geoProspectReports.id,
      shareToken: geoProspectReports.shareToken,
      status: geoProspectReports.status,
      companyName: geoProspectReports.companyName,
      companyDomain: geoProspectReports.companyDomain,
      visibilityScore: geoProspectReports.visibilityScore,
      modelCount: geoProspectReports.modelCount,
      promptCount: geoProspectReports.promptCount,
      updatedAt: geoProspectReports.updatedAt,
    })
    .from(geoProspectReports)
    .where(eq(geoProspectReports.organizationId, organizationId))
    .orderBy(desc(geoProspectReports.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    shareToken: row.shareToken,
    status: row.status,
    company: { name: row.companyName, domain: row.companyDomain, category: "" },
    modelsTested: row.modelCount,
    promptsTracked: row.promptCount,
    visibilityScore: row.visibilityScore,
    updatedAt: row.updatedAt.toISOString(),
    kind: "saved",
  }));
}

export async function getGeoReport(organizationId: string, id: string) {
  return await db.query.geoProspectReports.findFirst({
    columns: { id: true, shareToken: true, report: true },
    where: and(
      eq(geoProspectReports.id, id),
      eq(geoProspectReports.organizationId, organizationId)
    ),
  });
}

/** Public lookup by share token; no auth, so only the report body leaves here. */
export async function getSharedGeoReport(
  shareToken: string
): Promise<GeoReport | null> {
  const row = await db.query.geoProspectReports.findFirst({
    columns: { report: true },
    where: eq(geoProspectReports.shareToken, shareToken),
  });
  return row?.report ?? null;
}
