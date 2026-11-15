import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteDeploymentClient } from "@/components/sites/site-deployment-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "Deployment · Notra Console",
};

export default async function SiteDeploymentPage({
  params,
}: {
  params: Promise<{ slug: string; siteId: string; deploymentId: string }>;
}) {
  const { slug, siteId, deploymentId } = await params;
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  return (
    <SiteDeploymentClient
      deploymentId={deploymentId}
      siteId={siteId}
      slug={slug}
    />
  );
}
