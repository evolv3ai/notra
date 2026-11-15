import { notFound, redirect } from "next/navigation";

import { getOrganizationsForUser, requireAuth } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import {
  moderationLinkPath,
  moderationRedirectPath,
} from "@/utils/moderation-links";

/** Slug-less entry for moderation links posted to Slack. */
export default async function ModeratePage({
  searchParams,
}: {
  searchParams: Promise<{
    site?: string | string[];
    action?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const { user, session } = await requireAuth(moderationLinkPath(params));
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  const organizations = await getOrganizationsForUser(user.id);
  const organization =
    organizations.find((item) => item.id === session.activeOrganizationId) ??
    organizations[0];
  if (!organization) {
    notFound();
  }
  redirect(moderationRedirectPath(organization.slug, params));
}
