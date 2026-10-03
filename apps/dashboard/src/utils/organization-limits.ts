// Self-hosted instances can set NEXT_PUBLIC_UNLIMITED_ORGANIZATIONS=true to let
// users create additional organizations without a paid plan.
export function canCreateAdditionalOrganizations(
  hasActivePaidPlan: boolean
): boolean {
  return (
    hasActivePaidPlan ||
    process.env.NEXT_PUBLIC_UNLIMITED_ORGANIZATIONS === "true"
  );
}
