import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GeoReportsClient } from "@/components/geo-reports/geo-reports-client";
import { GEO_REPORTS } from "@/constants/geo-report-example";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import { listGeoReports } from "@/lib/geo-reports/queries";

export const metadata: Metadata = {
  title: "GEO Reports · Notra Console",
};

export default async function GeoReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, organization } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  const saved = await listGeoReports(organization.id);

  return <GeoReportsClient reports={[...saved, ...GEO_REPORTS]} slug={slug} />;
}
