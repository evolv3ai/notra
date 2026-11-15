import { redirect } from "next/navigation";

import { CreateWorkspace } from "@/components/auth/create-workspace";
import { getOrganizationsForUser, requireAuth } from "@/lib/auth/actions";

export default async function DashboardPage() {
  const { user, session } = await requireAuth();
  const organizations = await getOrganizationsForUser(user.id);
  const organization =
    organizations.find((item) => item.id === session.activeOrganizationId) ??
    organizations[0];

  if (organization) {
    redirect(`/${organization.slug}/integrations`);
  }

  return <CreateWorkspace />;
}
