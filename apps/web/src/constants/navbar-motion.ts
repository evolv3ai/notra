import { tween } from "@notra/ui/lib/motion";

export const NAVBAR_PANEL_ENTER = { opacity: 0, y: -6, scale: 0.98 } as const;
export const NAVBAR_PANEL_REST = { opacity: 1, y: 0, scale: 1 } as const;
export const NAVBAR_PANEL_EXIT = { opacity: 0, y: -4, scale: 0.99 } as const;

export const NAVBAR_MORPH_TRANSITION = {
  type: "spring",
  bounce: 0,
  duration: 0.4,
} as const;
export const NAVBAR_ENTER_TRANSITION = {
  type: "spring",
  bounce: 0,
  duration: 0.35,
  opacity: tween("normal", "out"),
} as const;
export const NAVBAR_EXIT_TRANSITION = tween("fast", "out");

const NAVBAR_CONTENT_SHIFT = 24;

export const NAVBAR_CONTENT_TRANSITION = {
  ...NAVBAR_MORPH_TRANSITION,
  opacity: tween("normal", "out"),
} as const;

export const NAVBAR_CONTENT_VARIANTS = {
  enter: (direction: number) => ({
    x: direction * NAVBAR_CONTENT_SHIFT,
    opacity: 0,
    pointerEvents: "none" as const,
  }),
  center: {
    x: 0,
    opacity: 1,
    pointerEvents: "none" as const,
    transitionEnd: { pointerEvents: "auto" as const },
  },
  exit: (direction: number) => ({
    x: direction * -NAVBAR_CONTENT_SHIFT,
    opacity: direction === 0 ? 1 : 0,
    pointerEvents: "none" as const,
    transition:
      direction === 0
        ? { duration: 0 }
        : { ...NAVBAR_MORPH_TRANSITION, opacity: tween("fast", "out") },
  }),
};
