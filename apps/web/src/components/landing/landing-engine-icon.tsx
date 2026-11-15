import { cn } from "@notra/ui/lib/utils";

import { LANDING_ENGINE_ICONS } from "@/constants/landing/geo-engines";
import type { LandingEngineIconProps } from "@/types/landing/geo";

export function LandingEngineIcon({
  engine,
  className,
}: LandingEngineIconProps) {
  const [Light, Dark] = LANDING_ENGINE_ICONS[engine];
  const iconClass = cn(
    "size-4 shrink-0",
    engine === "gemini" && "overflow-visible",
    className
  );
  return (
    <span aria-hidden="true" className="contents">
      {Dark ? (
        <>
          <Light className={cn(iconClass, "block dark:hidden")} />
          <Dark className={cn(iconClass, "hidden dark:block")} />
        </>
      ) : (
        <Light className={iconClass} />
      )}
    </span>
  );
}
