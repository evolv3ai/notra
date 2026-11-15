import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutopilotTraceClient } from "@/components/autopilot/autopilot-trace-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import type { AutopilotTraceRouteProps } from "@/types/autopilot";

export const metadata: Metadata = { title: "Autopilot run · Notra Console" };

export default async function AutopilotTracePage({
  params,
}: AutopilotTraceRouteProps) {
  const { slug, runId } = await params;
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  return <AutopilotTraceClient key={runId} slug={slug} runId={runId} />;
}
