import type { Vec } from "@/types/compare-duel";

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const rnd = (min: number, max: number) =>
  min + Math.random() * (max - min);
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Two-bone inverse kinematics: the joint and end point of a limb reaching from `a` toward `t`. */
export function ik(
  a: Vec,
  t: Vec,
  l1: number,
  l2: number,
  bend: number
): { j: Vec; e: Vec } {
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const dc = clamp(d, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const phi = Math.atan2(dy, dx);
  const al = Math.acos(
    clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1)
  );
  return {
    j: {
      x: a.x + l1 * Math.cos(phi + bend * al),
      y: a.y + l1 * Math.sin(phi + bend * al),
    },
    e: { x: a.x + (dx / d) * dc, y: a.y + (dy / d) * dc },
  };
}

/** Where segments p1-p2 and p3-p4 cross, with the position along each, or null. */
export function segmentHit(
  p1: Vec,
  p2: Vec,
  p3: Vec,
  p4: Vec
): (Vec & { ua: number; ub: number }) | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) {
    return null;
  }
  const ua =
    ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const ub =
    ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
    return null;
  }
  return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y), ua, ub };
}
