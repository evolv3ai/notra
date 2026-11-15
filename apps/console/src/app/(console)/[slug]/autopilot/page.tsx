import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutopilotRunsClient } from "@/components/autopilot/autopilot-runs-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import type { AutopilotRouteProps } from "@/types/autopilot";

export const metadata: Metadata = { title: "Autopilot · Notra Console" };

export default async function AutopilotPage({ params }: AutopilotRouteProps) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  return <AutopilotRunsClient slug={slug} />;
}
