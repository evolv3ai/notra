import {
  CAPE_DRAG,
  CAPE_FLOW,
  CAPE_LINK,
  CAPE_LINKS,
  GRAVITY,
} from "@/constants/compare/duel";
import { clamp } from "@/lib/compare-duel/geometry";
import type { CapeNode, Fighter, Vec } from "@/types/compare-duel";

const RELAX_PASSES = 3;
/** How far behind the body line the cloth stays. */
const BODY_GAP = 0.02;
/** Share of the way back behind the body a link moves each step. */
const BODY_PUSH = 0.35;
const FLOOR = 0.01;

/** The cape is pinned just behind the shoulders, so it reads as hanging off the back. */
function anchor(f: Fighter): Vec {
  const { sh } = f.pose;
  return { x: sh.x - f.face.x * 0.03, y: sh.y + 0.01 };
}

/** A cape hanging straight down from `f`'s shoulders. */
export function createCape(f: Fighter): CapeNode[] {
  const top = anchor(f);
  return Array.from({ length: CAPE_LINKS + 1 }, (_, i) => {
    const y = Math.max(FLOOR, top.y - i * CAPE_LINK);
    return { x: top.x, y, px: top.x, py: y };
  });
}

/** Advances the cape by `h` seconds: verlet steps, then a few passes that pull each link back to length. */
export function stepCape(f: Fighter, h: number) {
  const nodes = f.cape;
  const top = anchor(f);
  const keep = Math.exp(-h * CAPE_DRAG);
  const flow = -f.face.x * CAPE_FLOW * h * h;
  const fall = GRAVITY * h * h;
  for (const [i, n] of nodes.entries()) {
    const x = i === 0 ? top.x : n.x + (n.x - n.px) * keep + flow;
    const y = i === 0 ? top.y : n.y + (n.y - n.py) * keep - fall;
    n.px = n.x;
    n.py = n.y;
    n.x = x;
    n.y = y;
  }
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1];
      const b = nodes[i];
      if (!(a && b)) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const k = (d - CAPE_LINK) / d;
      // the pinned top link never moves, so the next one takes the whole correction
      const share = i === 1 ? 1 : 0.5;
      b.x -= dx * k * share;
      b.y -= dy * k * share;
      if (i > 1) {
        a.x += dx * k * 0.5;
        a.y += dy * k * 0.5;
      }
      b.y = Math.max(FLOOR, b.y);
    }
  }
  keepBehind(f);
}

/**
 * Cloth can't pass through the body: links that swing in front of the line from shoulder to hip are pushed
 * back behind it. While Notra turns side-on during a spin the cape is left free to swing round.
 */
function keepBehind(f: Fighter) {
  const facing = f.face.x;
  if (Math.abs(facing) < 0.5) {
    return;
  }
  const side = Math.sign(facing);
  const { sh, hip } = f.pose;
  for (const n of f.cape.slice(1)) {
    const t = clamp((sh.y - n.y) / (sh.y - hip.y || 1), 0, 1);
    const back = sh.x + (hip.x - sh.x) * t - side * BODY_GAP;
    if ((n.x - back) * side > 0) {
      // eased back over a few steps, so the cape slides round the body instead of jumping
      const shift = (back - n.x) * BODY_PUSH;
      n.px += shift;
      n.x += shift;
    }
  }
}
