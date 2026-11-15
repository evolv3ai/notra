import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SystemSkillEditorClient } from "@/components/skills/system-skill-editor-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import type { SystemSkillsRouteProps } from "@/types/skills";

export const metadata: Metadata = { title: "New System Skill · Notra Console" };

export default async function NewSystemSkillPage({
  params,
}: SystemSkillsRouteProps) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  return <SystemSkillEditorClient name={null} slug={slug} />;
}
