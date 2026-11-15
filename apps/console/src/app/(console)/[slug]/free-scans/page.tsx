import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FreeScansClient } from "@/components/free-scans/free-scans-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import type { FreeScansRouteProps } from "@/types/free-scans";

export const metadata: Metadata = { title: "Free Scans · Notra Console" };

export default async function FreeScansPage({ params }: FreeScansRouteProps) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  return <FreeScansClient />;
}
