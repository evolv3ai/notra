import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import {
  DARK_BACKDROP_THEME,
  LIGHT_BACKDROP_THEME,
} from "@/constants/compare/duel";
import { useDuelCanvas } from "@/lib/compare-duel/use-duel-canvas";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  subscribeToReducedMotion,
} from "@/utils/reduced-motion";

/** Notra duels the other vendors in a strip along the bottom of the hero, faint enough to read as part of the dither. */
export function CompareHeroDuel() {
  const dark = useTheme().resolvedTheme === "dark";
  const stageRef = useDuelCanvas({
    theme: dark ? DARK_BACKDROP_THEME : LIGHT_BACKDROP_THEME,
    reducedMotion: useSyncExternalStore(
      subscribeToReducedMotion,
      getReducedMotionSnapshot,
      getReducedMotionServerSnapshot
    ),
  });
  // raised blades fade out before they reach the button, and the floor line fades out at the sides
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-56 [mask-image:linear-gradient(to_top,black_55%,transparent),linear-gradient(to_right,transparent,black_30%,black_70%,transparent)] [mask-composite:intersect] opacity-55 lg:h-72 dark:opacity-45"
      ref={stageRef}
    />
  );
}
