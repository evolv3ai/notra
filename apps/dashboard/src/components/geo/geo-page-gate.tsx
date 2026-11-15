"use client";

import { GeoUpgradeGate } from "@/components/geo/geo-upgrade-gate";
import { useParams, usePathname } from "@/lib/navigation";
import type { GeoPageGateProps } from "@/types/components/geo";
import { isGeoPaywalledPath } from "@/utils/geo-paths";

export function GeoPageGate({
  children,
  initialAccess,
  fallback,
}: GeoPageGateProps) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();

  if (!isGeoPaywalledPath(pathname)) {
    return children;
  }

  return (
    <GeoUpgradeGate
      fallback={fallback}
      initialAccess={initialAccess}
      slug={slug}
    >
      {children}
    </GeoUpgradeGate>
  );
}
