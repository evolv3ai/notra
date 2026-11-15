/** Dots of the agent mark; `orbit` is the clockwise position on the outer ring. */
export const AGENT_ICON_DOTS = [
  { cx: 12, cy: 12, r: 2.9, orbit: null },
  { cx: 12, cy: 5, r: 2.1, orbit: 0 },
  { cx: 19, cy: 12, r: 2.1, orbit: 2 },
  { cx: 12, cy: 19, r: 2.1, orbit: 4 },
  { cx: 5, cy: 12, r: 2.1, orbit: 6 },
  { cx: 5, cy: 5, r: 1.35, orbit: 7 },
  { cx: 19, cy: 5, r: 1.35, orbit: 1 },
  { cx: 19, cy: 19, r: 1.35, orbit: 3 },
  { cx: 5, cy: 19, r: 1.35, orbit: 5 },
] as const;

export const AGENT_LOADER_CYCLE_MS = 1200;
