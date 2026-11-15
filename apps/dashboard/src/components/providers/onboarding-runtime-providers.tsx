"use client";

import { AutumnOrgProvider } from "@/components/providers/autumn-org-provider";
import { DatabaseProvider } from "@/components/providers/database-provider";
import { DatabuddyIdentity } from "@/components/providers/databuddy-identity";

export function OnboardingRuntimeProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DatabaseProvider>
      <AutumnOrgProvider>
        <DatabuddyIdentity />
        {children}
      </AutumnOrgProvider>
    </DatabaseProvider>
  );
}
