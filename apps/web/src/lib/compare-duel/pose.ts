import {
  BLADE,
  FORE,
  HEAD_R,
  HILT,
  NECK,
  REACH,
  SHIN,
  TAU,
  THIGH,
  TORSO,
  UPPER,
} from "@/constants/compare/duel";
import { clamp, ik, lerp } from "@/lib/compare-duel/geometry";
import { Spring } from "@/lib/compare-duel/spring";
import type { DuelBlade, Fighter, Foot, Pose, Vec } from "@/types/compare-duel";

export function createFoot(x: number): Foot {
  return { x, lift: 0, x0: x, x1: x, st: 1, dur: 0.12 };
}

export function createFighter(
  blade: DuelBlade,
  x: number,
  dir: number
): Fighter {
  const fighter: Fighter = {
    blade,
    x: new Spring(x, 9, 1),
    face: new Spring(dir, 20, 1),
    crouch: new Spring(0.3, 10, 0.8),
    lean: new Spring(0.1, 10, 0.8),
    hx: new Spring(0.06, 12, 0.8),
    hy: new Spring(-0.3, 12, 0.8),
    ang: new Spring(-1.2, 12, 0.8),
    ext: new Spring(0, 14, 1),
    ox: new Spring(-dir * 0.08, 26, 1),
    oy: new Spring(-0.3, 26, 1),
    air: new Spring(0, 18, 1),
    y: 0,
    yv: 0,
    xvAir: 0,
    airT: 0,
    airDur: 1,
    flip: 0,
    rot: 0,
    airborne: false,
    feet: [createFoot(x + dir * 0.17), createFoot(x - dir * 0.14)],
    twoHand: false,
    gripOff: { x: 0, y: -0.3 },
    heat: 0,
    turnLock: 0,
    ghosts: [],
    ghostClock: 0,
    trail: [],
    cape: [],
    pose: undefined as unknown as Pose,
    prev: null,
  };
  fighter.pose = computePose(fighter);
  return fighter;
}

/**
 * World positions of every joint, the hilt and the blade. Also stores where the off hand should grip.
 * The blade is kept out of the floor, its wielder's head and, given `opponent`, the other fighter's head and body.
 */
export function computePose(f: Fighter, opponent?: Pose): Pose {
  const d = f.face.x;
  const sd = d >= 0 ? 1 : -1;
  const air = f.air.x;
  const hip = { x: f.x.x, y: f.y + 0.47 - f.crouch.x * 0.17 };
  // in a wide stance a straight leg falls just short of the floor, so the hip sinks a little until it reaches
  const leg = (THIGH + SHIN) * 0.998;
  for (const ft of f.feet) {
    const dx = Math.abs(ft.x - hip.x);
    const highest = ft.lift + Math.sqrt(Math.max(0, leg * leg - dx * dx));
    hip.y = Math.max(hip.y - MAX_SINK * (1 - air), Math.min(hip.y, highest));
  }
  const lean = f.lean.x;
  const neck = {
    x: hip.x + d * Math.sin(lean) * TORSO,
    y: hip.y + Math.cos(lean) * TORSO,
  };
  const headLean = lean * 1.25;
  const head = {
    x: neck.x + d * Math.sin(headLean) * (NECK + HEAD_R),
    y: neck.y + Math.cos(headLean) * (NECK + HEAD_R),
  };
  const sh = {
    x: neck.x - d * Math.sin(lean) * 0.035,
    y: neck.y - Math.cos(lean) * 0.035,
  };

  const arm = ik(
    sh,
    outsideHead({ x: sh.x + d * f.hx.x, y: sh.y + f.hy.x }, head),
    UPPER,
    FORE,
    -sd
  );
  const hand = arm.e;
  const u = { x: d * Math.cos(f.ang.x), y: Math.sin(f.ang.x) };
  const pommel = {
    x: hand.x - u.x * HILT * 0.55,
    y: hand.y - u.y * HILT * 0.55,
  };
  const base = { x: hand.x + u.x * HILT * 0.45, y: hand.y + u.y * HILT * 0.45 };
  const length = BLADE * Math.max(0, f.ext.x);
  const obstacles: Obstacle[] = [{ c: head, r: HEAD_CLEARANCE }];
  if (opponent) {
    obstacles.push({ c: opponent.head, r: HEAD_CLEARANCE });
    for (const t of [0, 0.5, 1]) {
      obstacles.push({
        c: lerpVec(opponent.hip, opponent.neck, t),
        r: TORSO_CLEARANCE,
      });
    }
  }
  aimClear(u, hand, length, obstacles, d);
  base.x = hand.x + u.x * HILT * 0.45;
  base.y = hand.y + u.y * HILT * 0.45;
  pommel.x = hand.x - u.x * HILT * 0.55;
  pommel.y = hand.y - u.y * HILT * 0.55;
  const tip = { x: base.x + u.x * length, y: base.y + u.y * length };
  f.gripOff = {
    x: hand.x - u.x * 0.085 - sh.x,
    y: hand.y - u.y * 0.085 - sh.y,
  };

  const off = ik(sh, { x: sh.x + f.ox.x, y: sh.y + f.oy.x }, UPPER, FORE, -sd);
  const feet = f.feet.map((ft, i) => ({
    x: lerp(ft.x, hip.x + d * (i === 0 ? 0.13 : -0.07), air),
    y: Math.max(0, lerp(ft.lift, hip.y - (i === 0 ? 0.3 : 0.34), air)),
  }));
  const legs = feet.map((ft) => ik(hip, ft, THIGH, SHIN, sd));

  const pose: Pose = {
    hip,
    neck,
    head,
    sh,
    elbow: arm.j,
    hand,
    pommel,
    base,
    tip,
    offElbow: off.j,
    offHand: off.e,
    knees: legs.map((leg) => leg.j),
    feet: legs.map((leg) => leg.e),
  };
  if (f.rot) {
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    const px = hip.x;
    const py = hip.y + 0.15;
    const rotate = (q: Vec) => {
      const dx = q.x - px;
      const dy = q.y - py;
      q.x = px + dx * c - dy * s;
      q.y = py + dx * s + dy * c;
    };
    [
      pose.hip,
      pose.neck,
      pose.head,
      pose.sh,
      pose.elbow,
      pose.hand,
      pose.pommel,
      pose.base,
      pose.tip,
      pose.offElbow,
      pose.offHand,
      ...pose.knees,
      ...pose.feet,
    ].forEach(rotate);
  }
  return pose;
}

const HEAD_CLEARANCE = HEAD_R * 1.15;
/** How far the hip may drop to keep a planted foot on the floor. */
const MAX_SINK = 0.07;
const TORSO_CLEARANCE = 0.04;
/** The grip stays this far from the head's centre, so a raised hilt is held beside the head, not inside it. */
const GRIP_CLEARANCE = HEAD_R + 0.05;

/** Moves a hand target that falls inside the head straight out to its edge. */
function outsideHead(target: Vec, head: Vec): Vec {
  const dx = target.x - head.x;
  const dy = target.y - head.y;
  const d = Math.hypot(dx, dy);
  if (d >= GRIP_CLEARANCE) {
    return target;
  }
  // straight below the head the way out is down, towards the chest
  const nx = d > 1e-6 ? dx / d : 0;
  const ny = d > 1e-6 ? dy / d : -1;
  return { x: head.x + nx * GRIP_CLEARANCE, y: head.y + ny * GRIP_CLEARANCE };
}
const MAX_NUDGE = 1;
const NUDGE_STEP = 0.04;

interface Obstacle {
  c: Vec;
  r: number;
}

const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});

/**
 * Tilts the blade direction `u` just enough that the saber neither sinks into the floor nor passes through
 * a head or body, the way a real blade would scrape along the ground or be pulled past a face.
 * `u` may be shorter than 1 while the fighter turns side-on, and keeps its length.
 */
function aimClear(
  u: Vec,
  hand: Vec,
  length: number,
  obstacles: Obstacle[],
  facing: number
) {
  const m = Math.hypot(u.x, u.y);
  if (length < 0.05 || m < 1e-3) {
    return;
  }
  const reach = HILT * 0.45 + length;
  // the floor: lay the blade down so the tip only reaches floor level
  if (hand.y > 0 && hand.y + u.y * reach < 0) {
    u.y = Math.max(-m, -hand.y / reach);
    u.x =
      (Math.sign(u.x) || Math.sign(facing) || 1) * Math.sqrt(m * m - u.y * u.y);
  }
  // heads and bodies: turn the blade away from the first one it touches until it clears them all
  let turn = 0;
  for (let turned = 0; turned < MAX_NUDGE; turned += NUDGE_STEP) {
    const nx = u.x / m;
    const ny = u.y / m;
    const bx = hand.x + u.x * HILT * 0.45;
    const by = hand.y + u.y * HILT * 0.45;
    const hit = obstacles.find(({ c, r }) => {
      const along = clamp((c.x - bx) * nx + (c.y - by) * ny, 0, length * m);
      return Math.hypot(c.x - bx - nx * along, c.y - by - ny * along) < r;
    });
    if (!hit) {
      return;
    }
    // keep turning the same way once started, so the blade never flips sides
    turn ||= nx * (hit.c.y - by) - ny * (hit.c.x - bx) > 0 ? -1 : 1;
    const c = Math.cos(NUDGE_STEP * turn);
    const s = Math.sin(NUDGE_STEP * turn);
    const x = u.x * c - u.y * s;
    u.y = u.x * s + u.y * c;
    u.x = x;
  }
}

/** Keeps the blade angle in [-π/2, 3π/2) so springs take the path over the top. */
export function normalizeAngle(f: Fighter) {
  while (f.ang.x >= 1.5 * Math.PI) {
    f.ang.x -= TAU;
    f.ang.t -= TAU;
  }
  while (f.ang.x < -0.5 * Math.PI) {
    f.ang.x += TAU;
    f.ang.t += TAU;
  }
}

/** Where the shoulder will be once the fighter reaches its current targets. */
export function shoulderTarget(f: Fighter, d: number): Vec {
  const hipY = 0.47 - f.crouch.t * 0.17;
  const r = TORSO - 0.035;
  return {
    x: f.x.t + d * Math.sin(f.lean.t) * r,
    y: hipY + Math.cos(f.lean.t) * r,
  };
}

/** Hand position relative to the shoulder that puts the blade at angle `a` through point `c`. */
export function solveHand(c: Vec, a: number, tPref: number): Vec {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const r = 0.3;
  const off = HILT * 0.45;
  const cu = c.x * ux + c.y * uy;
  const disc = cu * cu - (c.x * c.x + c.y * c.y) + r * r;
  let t = cu;
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    t = Math.abs(cu - s - tPref) < Math.abs(cu + s - tPref) ? cu - s : cu + s;
  }
  t = clamp(t, off + 0.12, off + BLADE * 0.92);
  let hx = c.x - ux * t;
  let hy = c.y - uy * t;
  const length = Math.hypot(hx, hy);
  const max = REACH * 0.97;
  if (length > max) {
    hx *= max / length;
    hy *= max / length;
  }
  return { x: hx, y: hy };
}
