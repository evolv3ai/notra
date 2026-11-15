import {
  BLADE,
  CLASH_RGB,
  DUEL_LAYOUT,
  DIST,
  DUEL_BOUT_S,
  GRAVITY,
  DUEL_STAGE_HALF_WIDTH,
  NOTRA_BLADE,
  REACH,
  RIVAL_BLADE,
  STRIKES,
  STRIKE_NAMES,
  TAU,
} from "@/constants/compare/duel";
import { createCape, stepCape } from "@/lib/compare-duel/cape";
import {
  clamp,
  lerp,
  rnd,
  segmentHit,
  smooth,
} from "@/lib/compare-duel/geometry";
import {
  computePose,
  createFighter,
  createFoot,
  normalizeAngle,
  shoulderTarget,
  solveHand,
} from "@/lib/compare-duel/pose";
import type {
  Contact,
  DuelPhase,
  DuelScript,
  Fighter,
  Flash,
  Ring,
  Scorch,
  Spark,
  StrikeName,
  StrikeStyle,
  Vec,
} from "@/types/compare-duel";

type Script = DuelScript;

const SUBSTEPS = 4;
const MAX_BOUNCES = 6;
// A saber lock: each fighter stands this far from the middle, leaning in, blades crossing at this height and angle.
const LOCK_GAP = 0.55;
const LOCK_LEAN = 0.22;
const LOCK_HEIGHT = 0.98;
const LOCK_ANGLE = 1.2;

/**
 * The hero duel on the compare page: Notra, in a cape and with a green saber, duels one red-saber vendor
 * after another and wins every bout. The beaten vendor's saber cuts out, then the next one gets up.
 */
export class DuelEngine {
  readonly notra = createFighter(NOTRA_BLADE, -0.95, 1);
  readonly rival = createFighter(RIVAL_BLADE, 0.95, -1);
  readonly fighters: Fighter[];

  width = 0;
  height = 0;
  scale = 1;
  ground = 0;
  sparks: Spark[] = [];
  flashes: Flash[] = [];
  rings: Ring[] = [];
  scorches: Scorch[] = [];
  contact: Contact | null = null;
  phase: DuelPhase = "intro";

  private readonly reduceMotion: boolean;
  private time = 0;
  private lastClash = -1;
  private stuck = false;
  /** Substeps in a row that pushed the blades apart; past a few they grind instead, so nobody freezes. */
  private bounces = 0;
  private roundTime = 0;
  private readonly script: Script;
  private wait = 0;

  constructor(reduceMotion: boolean) {
    this.reduceMotion = reduceMotion;
    this.notra.cape = createCape(this.notra);
    this.fighters = [this.notra, this.rival];
    this.script = this.duel();
  }

  /** Keeps the previous layout for an empty stage, since a zero scale would turn every position into NaN. */
  resize(width: number, height: number) {
    if (!(width > 0 && height > 0)) {
      return;
    }
    this.width = width;
    this.height = height;
    this.scale = Math.min(height * DUEL_LAYOUT.scale, width / 3.4);
    this.ground = height * DUEL_LAYOUT.ground;
  }

  simulate(dt: number) {
    this.time += dt;
    if (this.phase === "fight" || this.phase === "lock") {
      this.roundTime += dt;
    }
    this.wait -= dt;
    while (this.wait <= 0) {
      this.wait += Math.max(0.001, this.script.next().value || 0);
    }

    const h = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) {
      for (const f of this.fighters) {
        f.prev = {
          x: f.x.x,
          crouch: f.crouch.x,
          lean: f.lean.x,
          face: f.face.x,
          hx: f.hx.x,
          hy: f.hy.x,
          ang: f.ang.x,
        };
        this.stepFighter(f, h);
      }
      for (const f of this.fighters) {
        f.pose = computePose(f, this.other(f).pose);
      }
      this.resolveBlades();
      stepCape(this.notra, h);
    }

    for (const f of this.fighters) {
      this.updateFeet(f, dt);
      this.updateGhosts(f, dt);
      f.heat *= Math.exp(-dt * 5);
      f.turnLock -= dt;
      const p = f.pose;
      if (f.ext.x > 0.5 && p.tip.y < 0.015 && Math.random() < 0.12) {
        this.scorchFloor(p.tip.x, 0.1);
      }
      if (f.ext.x > 0.2) {
        f.trail.unshift({
          b: {
            x: lerp(p.base.x, p.tip.x, 0.4),
            y: lerp(p.base.y, p.tip.y, 0.4),
          },
          t: { ...p.tip },
        });
        if (f.trail.length > 9) {
          f.trail.pop();
        }
      } else {
        f.trail.length = 0;
      }
    }

    for (const s of this.sparks) {
      s.life -= dt;
      s.vy -= 7 * dt;
      s.vx *= 1 - 1.6 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < 0) {
        // sparks hitting the floor skip once and burn out instead of sliding around
        s.y = 0;
        s.vy *= -0.25;
        s.vx *= 0.5;
        s.life = Math.min(s.life, s.max * 0.25);
      }
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const flash of this.flashes) {
      flash.life -= dt;
    }
    this.flashes = this.flashes.filter((flash) => flash.life > 0);
    for (const ring of this.rings) {
      ring.life -= dt;
    }
    this.rings = this.rings.filter((ring) => ring.life > 0);
    for (const scorch of this.scorches) {
      scorch.life -= dt;
    }
    this.scorches = this.scorches.filter((scorch) => scorch.life > 0);
    if (this.contact) {
      this.contact.life -= dt;
      if (this.contact.life <= 0) {
        this.contact = null;
      }
    }
  }

  // ---------- physics

  private other(f: Fighter) {
    return f === this.notra ? this.rival : this.notra;
  }

  private sideDir(f: Fighter, o: Fighter) {
    return Math.sign(o.x.x - f.x.x) || (f === this.notra ? 1 : -1);
  }

  /** The fight stays under the hero's button instead of roaming the whole width. */
  private arenaLimit() {
    return Math.min(DUEL_STAGE_HALF_WIDTH, this.width / 2 / this.scale - 0.42);
  }

  private stepFighter(f: Fighter, h: number) {
    const o = this.other(f);
    const canTurn =
      f.turnLock <= 0 &&
      (!f.airborne || (f.flip !== 0 && f.airT > f.airDur * 0.5));
    if (canTurn && Math.abs(o.x.x - f.x.x) > 0.04) {
      f.face.t = Math.sign(o.x.x - f.x.x);
    }
    f.face.step(h);

    if (f.airborne) {
      f.airT += h;
      f.yv -= GRAVITY * h;
      f.y += f.yv * h;
      f.x.x += f.xvAir * h;
      f.x.t = f.x.x;
      f.x.v = 0;
      f.rot = f.flip * smooth(clamp(f.airT / f.airDur, 0, 1));
      if (f.y <= 0 && f.yv < 0) {
        this.land(f);
      }
    } else {
      f.x.step(h);
    }
    const limit = this.arenaLimit();
    f.x.t = clamp(f.x.t, -limit, limit);
    if (Math.abs(f.x.x) > limit + 0.2) {
      f.x.x = Math.sign(f.x.x) * (limit + 0.2);
      f.x.v = 0;
      f.xvAir = 0;
    }

    const grip =
      f.twoHand && Math.hypot(f.gripOff.x, f.gripOff.y) < REACH * 0.98;
    f.ox.t = grip ? f.gripOff.x : -f.face.x * 0.08;
    f.oy.t = grip ? f.gripOff.y : -0.3;
    for (const s of [
      f.crouch,
      f.lean,
      f.hx,
      f.hy,
      f.ang,
      f.ext,
      f.ox,
      f.oy,
      f.air,
    ]) {
      s.step(h);
    }
  }

  private updateFeet(f: Fighter, dt: number) {
    if (f.airborne) {
      return;
    }
    const d = Math.sign(f.face.t) || 1;
    const ideal = [f.x.x + d * 0.17, f.x.x - d * 0.14];
    let stepping = false;
    for (const ft of f.feet) {
      if (ft.st < 1) {
        stepping = true;
        ft.st = Math.min(1, ft.st + dt / ft.dur);
        ft.x = lerp(ft.x0, ft.x1, smooth(ft.st));
        ft.lift = Math.sin(Math.PI * ft.st) * 0.06;
      }
    }
    if (stepping) {
      return;
    }
    let worst = -1;
    let error = 0.09;
    f.feet.forEach((ft, i) => {
      const e = Math.abs(ft.x - (ideal[i] ?? ft.x));
      if (e > error) {
        error = e;
        worst = i;
      }
    });
    const ft = f.feet[worst];
    if (ft) {
      ft.x0 = ft.x;
      ft.x1 = (ideal[worst] ?? ft.x) + f.x.v * 0.08;
      ft.st = 0;
      ft.dur = 0.12;
    }
  }

  private launch(f: Fighter, vy: number, dx: number, flip = 0, tuck = 1) {
    f.airborne = true;
    f.yv = vy;
    f.airT = 0;
    f.airDur = (2 * vy) / GRAVITY;
    f.xvAir = dx / f.airDur;
    f.flip = flip;
    f.air.t = tuck;
  }

  private updateGhosts(f: Fighter, dt: number) {
    for (const ghost of f.ghosts) {
      ghost.life -= dt;
    }
    f.ghosts = f.ghosts.filter((ghost) => ghost.life > 0);
    f.ghostClock -= dt;
    const fast = f.airborne || f.turnLock > 0;
    if (!fast || f.ghostClock > 0 || this.reduceMotion) {
      return;
    }
    f.ghostClock = 0.035;
    f.ghosts.unshift({ pose: f.pose, life: 0.18, max: 0.18 });
    if (f.ghosts.length > 6) {
      f.ghosts.pop();
    }
  }

  private land(f: Fighter) {
    const impact = -f.yv;
    f.airborne = false;
    f.y = 0;
    f.yv = 0;
    f.rot = 0;
    f.flip = 0;
    f.air.t = 0;
    f.crouch.x = Math.min(1.2, f.crouch.x + 0.4);
    const d = this.sideDir(f, this.other(f));
    f.face.t = d;
    f.feet = [createFoot(f.x.x + d * 0.17), createFoot(f.x.x - d * 0.14)];
    if (impact > 3) {
      this.rings.push({
        x: f.x.x,
        y: 0,
        life: 0.45,
        max: 0.45,
        r: 0.9,
        rgb: f.blade.band,
        floor: true,
      });
      this.emitSparks({ x: f.x.x, y: 0.01 }, 10, 0.5, 1.6);
    }
  }

  private restore(f: Fighter) {
    const prev = f.prev;
    if (!prev) {
      return;
    }
    if (!f.airborne) {
      f.x.x = prev.x;
      f.x.v *= -0.2;
    }
    f.crouch.x = prev.crouch;
    f.lean.x = prev.lean;
    f.face.x = prev.face;
    f.hx.x = prev.hx;
    f.hy.x = prev.hy;
    f.ang.x = prev.ang;
    f.ang.v *= -0.25;
    f.hx.v *= -0.2;
    f.hy.v *= -0.2;
  }

  /** Blades are solid: when they cross, both fighters are pushed back to the last substep. */
  private resolveBlades() {
    const { notra: a, rival: b } = this;
    if (a.ext.x < 0.25 || b.ext.x < 0.25) {
      this.stuck = false;
      return;
    }
    const hit = segmentHit(a.pose.base, a.pose.tip, b.pose.base, b.pose.tip);
    if (!hit) {
      this.stuck = false;
      this.bounces = 0;
      return;
    }
    this.bounces++;
    if (this.stuck || this.bounces > MAX_BOUNCES) {
      this.grind(hit);
      return;
    }
    const speed =
      Math.abs(a.ang.v) * BLADE * hit.ua +
      Math.abs(b.ang.v) * BLADE * hit.ub +
      Math.hypot(a.hx.v, a.hy.v) +
      Math.hypot(b.hx.v, b.hy.v);
    this.restore(a);
    this.restore(b);
    a.pose = computePose(a, b.pose);
    b.pose = computePose(b, a.pose);
    if (segmentHit(a.pose.base, a.pose.tip, b.pose.base, b.pose.tip)) {
      this.stuck = true;
    }
    if (speed > 2.2 && this.time - this.lastClash > 0.11) {
      this.clash(hit, speed);
    } else {
      this.grind(hit);
    }
  }

  // ---------- effects

  private emitSparks(p: Vec, n: number, vmin: number, vmax: number) {
    for (let i = 0; i < n && this.sparks.length < 700; i++) {
      const a = Math.random() * TAU;
      const v = rnd(vmin, vmax);
      const life = rnd(0.12, 0.42);
      this.sparks.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v + v * 0.35,
        life,
        max: life,
      });
    }
  }

  private clash(p: Vec, speed: number) {
    const k = clamp(speed / 6, 0.4, 1.6);
    this.emitSparks(p, Math.round(8 + 14 * k), 1.4, 4.8 * k);
    this.flashes.push({
      x: p.x,
      y: p.y,
      life: 0.16,
      max: 0.16,
      r: 0.45 + 0.45 * k,
    });
    this.rings.push({
      x: p.x,
      y: p.y,
      life: 0.3,
      max: 0.3,
      r: 0.35 + 0.35 * k,
      rgb: CLASH_RGB,
      floor: false,
    });
    for (const f of this.fighters) {
      f.heat = Math.max(f.heat, k / 1.6);
    }
    this.lastClash = this.time;
  }

  private scorchFloor(x: number, w: number) {
    this.scorches.push({ x, w, life: 2.4, max: 2.4 });
    if (this.scorches.length > 60) {
      this.scorches.shift();
    }
    this.emitSparks({ x, y: 0.01 }, 2, 0.4, 1.4);
  }

  private grind(p: Vec) {
    this.contact = { x: p.x, y: p.y, life: 0.09 };
    if (Math.random() < 0.3) {
      this.emitSparks(p, 1 + Math.floor(Math.random() * 2), 0.6, 1.8);
    }
  }

  private ignite(f: Fighter) {
    f.ext.set(1, 16, 1);
    this.emitSparks(f.pose.base, 10, 0.4, 1.6);
    this.flashes.push({
      x: f.pose.base.x,
      y: f.pose.base.y,
      life: 0.2,
      max: 0.2,
      r: 0.5,
      rgb: f.blade.band,
    });
  }

  private guard(f: Fighter) {
    normalizeAngle(f);
    f.twoHand = true;
    f.hx.set(0.15, 11, 0.8);
    f.hy.set(-0.17, 11, 0.8);
    f.ang.set(rnd(1.15, 1.35), 11, 0.8);
    f.crouch.set(0.3, 9, 0.8);
    f.lean.set(0.1, 9, 0.8);
  }

  /** Steps both back to dueling distance, drifting back towards the middle. */
  private space() {
    const limit = this.arenaLimit();
    const mid = clamp(
      ((this.notra.x.t + this.rival.x.t) / 2) * 0.5,
      -limit + DIST / 2,
      limit - DIST / 2
    );
    const d = this.sideDir(this.notra, this.rival);
    this.notra.x.set(mid - (d * DIST) / 2, 8, 1);
    this.rival.x.set(mid + (d * DIST) / 2, 8, 1);
  }

  private pickStrike(last: StrikeName | null): StrikeName {
    let name: StrikeName;
    do {
      name =
        STRIKE_NAMES[Math.floor(Math.random() * STRIKE_NAMES.length)] ?? "mid";
    } while (name === last);
    return name;
  }

  /** Turns the back to the opponent with the blade sweeping low behind, ready to whip around. */
  private spinUp(A: Fighter, dA: number) {
    normalizeAngle(A);
    A.twoHand = false;
    A.turnLock = 0.2;
    A.face.t = -dA;
    A.x.set(A.x.t + dA * 0.12, 10, 0.9);
    A.crouch.set(0.6, 14, 0.8);
    A.lean.set(0.15, 12, 0.8);
    A.hx.set(0.3, 16, 0.8);
    A.hy.set(-0.12, 16, 0.8);
    A.ang.set(-0.25, 16, 0.8);
  }

  /** Draws the blade back for a strike. `w` speeds the springs up. */
  private windup(A: Fighter, name: StrikeName, w = 1) {
    const s = STRIKES[name];
    normalizeAngle(A);
    A.twoHand = name !== "thrust";
    A.hx.set(s.wind[0], 14 * w, 0.8);
    A.hy.set(s.wind[1], 14 * w, 0.8);
    A.ang.set(s.wa, 14 * w, 0.85);
    A.crouch.set(name === "low" ? 0.5 : 0.3, 10 * w, 0.8);
    A.lean.set(-0.05, 10 * w, 0.8);
  }

  /** Raises the defender's blade across the line of a strike meeting at `c`; `dA` points from attacker to defender. */
  private block(B: Fighter, dA: number, c: Vec, name: StrikeName, w = 1) {
    const s = STRIKES[name];
    normalizeAngle(B);
    B.twoHand = true;
    B.crouch.set(s.crouch, 12, 0.8);
    B.lean.set(-0.04, 12, 0.8);
    const sh = shoulderTarget(B, -dA);
    const hand = solveHand(
      { x: -dA * (c.x + dA * 0.1 - sh.x), y: c.y - sh.y },
      s.block,
      0.3
    );
    B.hx.set(hand.x, 20 * w, 0.8);
    B.hy.set(hand.y, 20 * w, 0.8);
    B.ang.set(s.block, 20 * w, 0.8);
  }

  /** Brings the blade down through `c` and past it. */
  private swing(
    A: Fighter,
    dA: number,
    c: Vec,
    name: StrikeName,
    snap: number
  ) {
    const s = STRIKES[name];
    A.lean.set(0.28, 14, 0.8);
    A.crouch.set(s.h < 0.5 ? 0.6 : 0.35, 12, 0.8);
    const sh = shoulderTarget(A, dA);
    const hand = solveHand({ x: dA * (c.x - sh.x), y: c.y - sh.y }, s.ca, 0.4);
    A.hx.set(hand.x + (s.push ?? 0), snap, 0.65);
    A.hy.set(hand.y, snap, 0.65);
    A.ang.set(s.ca + s.over, snap, 0.6);
  }

  private *strike(
    A: Fighter,
    B: Fighter,
    name: StrikeName,
    style: StrikeStyle = "plain"
  ): Script {
    const dA = this.sideDir(A, B);
    const limit = this.arenaLimit();
    const quick = style === "flurry";
    const w = quick ? 1.35 : 1;

    if (style === "spin") {
      this.spinUp(A, dA);
      yield 0.2;
    }

    let ax = A.x.t + dA * (quick ? rnd(0.04, 0.1) : rnd(0.08, 0.18));
    let bx = ax + dA * DIST;
    if (Math.abs(bx) > limit) {
      bx = Math.sign(bx) * limit;
      ax = bx - dA * DIST;
    }
    A.x.set(ax, 9 * w, 0.9);
    B.x.set(bx, 9 * w, 0.9);

    this.windup(A, name, w);
    if (style === "spin") {
      A.twoHand = false;
    }
    let windup = rnd(0.2, 0.34);
    if (quick) {
      windup = rnd(0.1, 0.14);
    } else if (style === "spin") {
      windup = rnd(0.1, 0.16);
    }
    yield windup * 0.5;

    // the defender reads the windup
    const c = { x: (ax + bx) / 2, y: STRIKES[name].h };
    this.block(B, dA, c, name, w);
    yield windup * 0.5;

    this.swing(A, dA, c, name, style === "spin" ? 38 : 30 * w);
    yield quick ? 0.13 : 0.18;
    yield quick ? rnd(0.01, 0.04) : rnd(0.03, 0.1);
  }

  /**
   * A rapid run of strikes, the last one lands in slow motion.
   * @yields {number} Seconds to wait before the next step.
   */
  private *flurry(A: Fighter, B: Fighter): Script {
    const count = 4 + Math.floor(Math.random() * 3);
    let last: StrikeName | null = null;
    for (let i = 0; i < count; i++) {
      last = this.pickStrike(last);
      yield* this.strike(A, B, last, i === count - 1 ? "spin" : "flurry");
    }
  }

  /**
   * Blades locked, both pushing, until one of them shoves through.
   * @yields {number} Seconds to wait before the next step.
   */
  private *lock(A: Fighter, B: Fighter): Script {
    this.phase = "lock";
    const dA = this.sideDir(A, B);
    let mid = (A.x.t + B.x.t) / 2;
    const limit = this.arenaLimit() - 0.5;
    // blades cross steeply in an X above the hands, so neither reaches the other fighter
    for (const [f, d] of [
      [A, dA],
      [B, -dA],
    ] as const) {
      normalizeAngle(f);
      f.twoHand = true;
      f.crouch.set(0.45, 8, 0.8);
      f.lean.set(LOCK_LEAN, 8, 0.8);
      const sh = shoulderTarget(f, d);
      const hand = solveHand(
        { x: d * (mid - sh.x), y: LOCK_HEIGHT - sh.y },
        LOCK_ANGLE,
        0.3
      );
      f.hx.set(hand.x, 16, 0.9);
      f.hy.set(hand.y, 16, 0.9);
      f.ang.set(LOCK_ANGLE, 16, 0.9);
    }
    // the blades come up into the X first, then both step in
    yield 0.18;
    A.x.set(mid - dA * LOCK_GAP, 8, 1);
    B.x.set(mid + dA * LOCK_GAP, 8, 1);
    const length = rnd(0.7, 1.1);
    for (let t = 0; t < length; t += 0.1) {
      yield 0.1;
      mid = clamp(mid + rnd(-0.04, 0.04), -limit, limit);
      A.x.t = mid - dA * LOCK_GAP;
      B.x.t = mid + dA * LOCK_GAP;
      A.lean.t = LOCK_LEAN + rnd(-0.05, 0.05);
      B.lean.t = LOCK_LEAN + rnd(-0.05, 0.05);
    }

    // Notra always shoves through
    const winner = this.notra;
    const loser = this.rival;
    this.launch(loser, 2, this.sideDir(winner, loser) * 0.6, 0, 0.35);
    loser.ang.v += 14 * (Math.random() < 0.5 ? 1 : -1);
    loser.lean.set(-0.15, 10, 0.8);
    winner.lean.set(0.38, 12, 0.8);
    winner.hx.v += 3;
    const at = this.contact ?? { x: mid, y: LOCK_HEIGHT };
    this.clash(at, 7);
    // the winner shoves through: a shockwave in their colour
    this.rings.push({
      x: at.x,
      y: at.y,
      life: 0.45,
      max: 0.45,
      r: 0.9,
      rgb: winner.blade.band,
      floor: false,
    });
    this.rings.push({
      x: at.x,
      y: 0,
      life: 0.6,
      max: 0.6,
      r: 1.8,
      rgb: winner.blade.band,
      floor: true,
    });
    this.phase = "fight";
    yield 0.35;
  }

  private *raise(f: Fighter): Script {
    normalizeAngle(f);
    f.twoHand = false;
    f.crouch.set(0.05, 6, 0.9);
    f.lean.set(-0.06, 6, 0.9);
    // held up in front rather than straight overhead, so the blade stays clear of the hero's button
    f.hx.set(0.1, 7, 0.9);
    f.hy.set(0.12, 7, 0.9);
    f.ang.set(1.2, 7, 0.9);
    yield 0.001;
  }

  /**
   * Notra lands the last blow: the vendor is knocked back, their saber cuts out, and Notra raises theirs.
   * @yields {number} Seconds to wait before the next step.
   */
  private *finale(): Script {
    this.phase = "finale";
    yield 0.25;
    const { notra, rival } = this;
    yield* this.strike(notra, rival, "high", "spin");
    const d = this.sideDir(notra, rival);
    const limit = this.arenaLimit();
    const landX = clamp(rival.x.x + d * 0.55, -limit, limit);
    this.clash(this.contact ?? { x: (notra.x.x + rival.x.x) / 2, y: 0.9 }, 7);
    this.launch(rival, 2.2, landX - rival.x.x, 0, 0.35);
    rival.ang.v += 12 * d;
    rival.lean.set(-0.25, 10, 0.8);
    rival.ext.set(0, 9, 1);
    notra.lean.set(0.38, 12, 0.8);
    yield 0.55;

    // the vendor sinks down, Notra steps back and raises their blade
    rival.x.set(landX, 8, 1);
    rival.crouch.set(1, 5, 0.9);
    rival.lean.set(0.35, 5, 0.9);
    rival.hy.set(-0.3, 6, 0.9);
    notra.x.set(notra.x.t - d * 0.2, 6, 1);
    yield* this.raise(notra);
    yield 1.7;
  }

  /**
   * The beaten vendor gets back up as the next one and ignites a fresh saber.
   * @yields {number} Seconds to wait before the next step.
   */
  private *nextRival(): Script {
    const { rival } = this;
    rival.ext.set(0, 9, 1);
    this.guard(this.notra);
    yield 0.55;
    this.guard(rival);
    yield 0.35;
    this.ignite(rival);
    yield 0.5;
    this.space();
    yield 0.6;
  }

  private *bout(): Script {
    this.roundTime = 0;
    this.phase = "fight";
    const length = rnd(DUEL_BOUT_S[0], DUEL_BOUT_S[1]);
    let last: StrikeName | null = null;

    while (this.roundTime < length) {
      let A = Math.random() < 0.5 ? this.rival : this.notra;
      if (
        Math.abs(this.other(A).x.t) > this.arenaLimit() - 0.15 &&
        Math.random() < 0.5
      ) {
        A = this.other(A);
      }
      const B = this.other(A);
      const move = Math.random();
      if (move < 0.18) {
        yield* this.flurry(A, B);
      } else {
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          last = this.pickStrike(last);
          yield* this.strike(
            A,
            B,
            last,
            Math.random() < 0.18 ? "spin" : "plain"
          );
        }
      }
      if (Math.random() < 0.2) {
        yield* this.lock(A, B);
      }
      this.guard(A);
      this.guard(B);
      this.space();
      yield rnd(0.2, 0.5);
    }
  }

  private *duel(): Script {
    yield 0.6;
    this.ignite(this.notra);
    this.guard(this.notra);
    yield 0.45;
    this.ignite(this.rival);
    this.guard(this.rival);
    yield 0.5;
    this.space();
    yield 0.6;

    for (;;) {
      yield* this.bout();
      yield* this.finale();
      yield* this.nextRival();
    }
  }
}
