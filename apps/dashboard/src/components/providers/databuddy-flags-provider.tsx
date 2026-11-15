"use client";

import { FlagsProvider } from "@databuddy/sdk/react";
import { type ReactNode, useMemo } from "react";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { authClient } from "@/lib/auth/client";

const databuddyClientId =
  process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID ?? "";

export function DatabuddyFlagsProvider({ children }: { children: ReactNode }) {
  const { activeOrganization } = useOrganizationsContext();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const email = session?.user.email;
  const organizationId = activeOrganization?.id;

  const user = useMemo(
    () =>
      userId
        ? {
            userId,
            email,
            organizationId,
            properties: organizationId ? { organizationId } : undefined,
          }
        : undefined,
    [userId, email, organizationId]
  );

  return (
    <FlagsProvider
      cacheTtl={5 * 60 * 1000}
      clientId={databuddyClientId}
      disabled={!databuddyClientId}
      isPending={isPending}
      skipStorage
      staleTime={5 * 60 * 1000}
      user={user}
    >
      {children}
    </FlagsProvider>
  );
}
