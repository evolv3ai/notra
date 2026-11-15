import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GeoReportEditor } from "@/components/geo-reports/editor/geo-report-editor";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import { getGeoReport } from "@/lib/geo-reports/queries";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const { user, organization } = await validateOrganizationAccess(slug);
  const row = hasAdminRole(user.role)
    ? await getGeoReport(organization.id, id)
    : null;
  const name = row?.report.company.name;
  return {
    title: name
      ? `${name} · GEO report · Notra Console`
      : "GEO report · Notra Console",
  };
}

export default async function EditGeoReportPage({ params }: PageProps) {
  const { slug, id } = await params;
  const { user, organization } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  const row = await getGeoReport(organization.id, id);
  if (!row) {
    notFound();
  }

  return (
    <GeoReportEditor
      initialReport={row.report}
      reportId={row.id}
      shareToken={row.shareToken}
      slug={slug}
    />
  );
}
