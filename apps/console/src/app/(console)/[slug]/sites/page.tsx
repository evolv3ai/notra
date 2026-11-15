import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SitesClient } from "@/components/sites/sites-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "Sites · Notra Console",
};

export default async function SitesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  return <SitesClient slug={slug} />;
}
