import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SystemSkillsClient } from "@/components/skills/system-skills-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import type { SystemSkillsRouteProps } from "@/types/skills";

export const metadata: Metadata = { title: "System Skills · Notra Console" };

export default async function SystemSkillsPage({
  params,
}: SystemSkillsRouteProps) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  return <SystemSkillsClient slug={slug} />;
}
