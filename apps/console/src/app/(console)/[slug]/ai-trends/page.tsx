import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AiTrendsClient } from "@/components/ai-trends/ai-trends-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "AI Search Trends · Notra Console",
};

export default async function AiTrendsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  return <AiTrendsClient />;
}
