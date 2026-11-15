"use client";

import { GeoUpgradeDialog } from "@/components/billing/geo-upgrade-dialog";
import { useInvalidateSites } from "@/lib/hooks/use-sites";
import type { SiteUpgradeDialogProps } from "@/types/components/sites";

/** Opens the upgrade dialog and refreshes Sites plan usage when it closes. */
export function SiteUpgradeDialog({
  organizationSlug,
  open,
  onOpenChange,
}: SiteUpgradeDialogProps) {
  const invalidateSites = useInvalidateSites();
  return (
    <GeoUpgradeDialog
      entry="sites"
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          invalidateSites();
        }
      }}
      open={open}
      slug={organizationSlug}
    />
  );
}
