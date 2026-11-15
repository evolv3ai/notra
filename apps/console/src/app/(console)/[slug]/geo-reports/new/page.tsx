import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GeoReportEditor } from "@/components/geo-reports/editor/geo-report-editor";
import { EXAMPLE_GEO_REPORT } from "@/constants/geo-report-example";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import { createEmptyReport } from "@/lib/geo-reports/draft";

export const metadata: Metadata = {
  title: "New GEO Report · Notra Console",
};

export default async function NewGeoReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ example?: string }>;
}) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  const { example } = await searchParams;
  const initialReport = example ? EXAMPLE_GEO_REPORT : createEmptyReport();

  return (
    <GeoReportEditor
      initialReport={initialReport}
      reportId={null}
      shareToken={null}
      slug={slug}
    />
  );
}
