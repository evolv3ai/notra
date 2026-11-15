import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GeoReportDocument } from "@/components/geo-reports/geo-report-document";
import { GEO_MODELS } from "@/constants/geo-report";
import { EXAMPLE_GEO_REPORT } from "@/constants/geo-report-example";
import { getSharedGeoReport } from "@/lib/geo-reports/queries";
import type { GeoReport } from "@/types/geo-report";
import { parseGeoShareSections } from "@/utils/geo-report";

type SharePageProps = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `reportId` is the share token, except for the built-in example. */
async function loadReport(reportId: string): Promise<GeoReport | null> {
  if (reportId === EXAMPLE_GEO_REPORT.id) {
    return EXAMPLE_GEO_REPORT;
  }
  return await getSharedGeoReport(reportId);
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { reportId } = await params;
  const report = await loadReport(reportId);
  if (!report) {
    return { title: "Report not found · Notra" };
  }
  return {
    title: `${report.company.name} · GEO report by Notra`,
    description: `Where ${report.company.name} shows up in AI answers, and where it is missing.`,
    robots: { index: false },
  };
}

/** Public, link-shareable report. No sign-in required. */
export default async function SharedGeoReportPage({
  params,
  searchParams,
}: SharePageProps) {
  const { reportId } = await params;
  const report = await loadReport(reportId);
  if (!report) {
    notFound();
  }

  const sections = parseGeoShareSections(await searchParams);
  const models = GEO_MODELS.filter((model) =>
    report.modelIds.includes(model.id)
  );

  return (
    <main className="geo-report min-h-svh">
      <div className="mx-auto max-w-5xl">
        <GeoReportDocument options={{ sections, models }} report={report} />
      </div>
    </main>
  );
}
