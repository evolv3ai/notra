import { Google } from "@notra/ui/components/ui/svgs/google";

import { EngineIcon } from "@/components/feature-pages/engine-icon";
import type { NavbarEngineLogoProps } from "@/types/navbar-bento";

export function NavbarEngineLogo({ engine }: NavbarEngineLogoProps) {
  if (engine === "google") {
    return <Google aria-hidden="true" className="size-4 shrink-0" />;
  }
  return <EngineIcon adaptive className="size-4" engine={engine} />;
}
