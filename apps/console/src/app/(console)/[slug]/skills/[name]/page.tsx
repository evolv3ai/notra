import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SystemSkillEditorClient } from "@/components/skills/system-skill-editor-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import type { SystemSkillRouteProps } from "@/types/skills";
import { parseSystemSkillName } from "@/utils/skills";

export const metadata: Metadata = { title: "System Skill · Notra Console" };

export default async function SystemSkillPage({
  params,
}: SystemSkillRouteProps) {
  const { slug, name } = await params;
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  const skillName = parseSystemSkillName(name);
  if (!skillName) {
    notFound();
  }
  return <SystemSkillEditorClient name={skillName} slug={slug} />;
}
