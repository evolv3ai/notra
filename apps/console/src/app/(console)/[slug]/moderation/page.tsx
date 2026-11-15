import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModerationClient } from "@/components/moderation/moderation-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "Moderation · Notra Console",
};

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  return <ModerationClient />;
}
