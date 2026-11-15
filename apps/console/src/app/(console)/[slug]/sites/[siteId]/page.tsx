import { SITE_CONSOLE_ACTIONS } from "@notra/sites-core/constants/sites";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteDetailClient } from "@/components/sites/site-detail-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "Site · Notra Console",
};

export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; siteId: string }>;
  searchParams: Promise<{ action?: string | string[] }>;
}) {
  const [{ slug, siteId }, { action }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  return (
    <SiteDetailClient
      action={SITE_CONSOLE_ACTIONS.find((value) => value === action)}
      siteId={siteId}
      slug={slug}
    />
  );
}
