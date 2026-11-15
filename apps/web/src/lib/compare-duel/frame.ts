import {
  CAPE_LOGO,
  CLASH_RGB,
  HEAD_R,
  WHITE_RGB,
} from "@/constants/compare/duel";
import {
  INSTANCE_FLOATS,
  MAX_BLADE_LIGHTS,
  RIBBON_FLOATS,
} from "@/constants/compare/duel-shaders";
import type { DuelEngine } from "@/lib/compare-duel/engine";
import { clamp } from "@/lib/compare-duel/geometry";
import type {
  DuelBlade,
  DuelFrame,
  DuelTheme,
  Fighter,
  Pose,
  Rgb,
  Vec,
} from "@/types/compare-duel";

const SOLID = 0;
const DITHER = 1;
const RING = 2;

const DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
  x: Math.cos((i * Math.PI) / 4),
  y: Math.sin((i * Math.PI) / 4),
}));

export function createDuelFrame(): DuelFrame {
  return {
    data: new Float32Array(2048 * INSTANCE_FLOATS),
    count: 0,
    ribbon: new Float32Array(256 * RIBBON_FLOATS),
    ribbonCount: 0,
    bladeSeg: new Float32Array(MAX_BLADE_LIGHTS * 4),
    bladeCol: new Float32Array(MAX_BLADE_LIGHTS * 4),
    view: { scale: 1, floorY: 0 },
    px: 0.02,
  };
}

/**
 * Collects one frame's shapes in painting order. Sizes are given in art pixels (`u`), so limbs and blades
 * keep crisp whole-pixel widths and grow with the camera zoom like everything else.
 */
class Painter {
  private readonly frame: DuelFrame;
  readonly u: number;

  constructor(frame: DuelFrame, u: number) {
    this.frame = frame;
    this.u = u;
  }

  capsule(
    a: Vec,
    b: Vec,
    r: number,
    c: Rgb,
    mode = SOLID,
    param = 0,
    density = 1
  ) {
    const frame = this.frame;
    if (frame.count * INSTANCE_FLOATS >= frame.data.length) {
      const grown = new Float32Array(frame.data.length * 2);
      grown.set(frame.data);
      frame.data = grown;
    }
    frame.data.set(
      [
        a.x,
        a.y,
        b.x,
        b.y,
        r,
        param,
        density,
        mode,
        c[0] / 255,
        c[1] / 255,
        c[2] / 255,
        1,
      ],
      frame.count++ * INSTANCE_FLOATS
    );
  }

  dot(p: Vec, r: number, c: Rgb) {
    this.capsule(p, p, r, c);
  }

  /** A soft-looking glow made of pixels that thin out towards the edge. */
  glow(a: Vec, b: Vec, r: number, c: Rgb, density: number) {
    this.capsule(a, b, r, c, DITHER, 1, density);
  }

  ring(p: Vec, r: number, width: number, c: Rgb) {
    this.capsule(p, p, r, c, RING, width);
  }

  vertex(p: Vec, c: Rgb, density: number) {
    const frame = this.frame;
    if ((frame.ribbonCount + 1) * RIBBON_FLOATS > frame.ribbon.length) {
      const grown = new Float32Array(frame.ribbon.length * 2);
      grown.set(frame.ribbon);
      frame.ribbon = grown;
    }
    frame.ribbon.set(
      [p.x, p.y, c[0] / 255, c[1] / 255, c[2] / 255, density],
      frame.ribbonCount++ * RIBBON_FLOATS
    );
  }
}

function limbs(
  paint: Painter,
  p: Pose,
  front: Rgb,
  back: Rgb,
  r: number,
  mode = SOLID,
  density = 1
) {
  const line = (points: (Vec | undefined)[], c: Rgb) => {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a && b) {
        paint.capsule(a, b, r, c, mode, 0, density);
      }
    }
  };
  line([p.sh, p.offElbow, p.offHand], back);
  line([p.hip, p.knees[1], p.feet[1]], back);
  line([p.hip, p.knees[0], p.feet[0]], front);
  line([p.hip, p.neck], front);
  line([p.sh, p.elbow, p.hand], front);
  paint.capsule(p.head, p.head, HEAD_R, front, mode, 0, density);
}

/** How far the cloth reaches out behind the cape's spine, from collar to hem. */
const CAPE_WIDTH: readonly [number, number] = [0.06, 0.34];
/** The hem trim covers this much of the cape's length. */
const CAPE_HEM = 0.16;

/** Where the logo sits, as a fraction of the cape's length. */
const CAPE_LOGO_AT = 0.6;

/**
 * The cape as a sheet of cloth: a strip that widens from collar to hem and always flares out behind Notra,
 * with a fold under the collar, a gold clasp and hem, and the Notra feather. It is painted before the figures,
 * so it sits behind them. `snap` moves a point onto the centre of its art pixel, which keeps the logo crisp.
 */
function capeCloth(
  paint: Painter,
  f: Fighter,
  theme: DuelTheme,
  snap: (p: Vec) => Vec
) {
  const nodes = f.cape;
  const last = nodes.length - 1;
  if (last < 1) {
    return;
  }
  const back = -(Math.sign(f.face.x) || 1);
  const edges = nodes.map((n, i) => {
    const prev = nodes[Math.max(0, i - 1)] ?? n;
    const next = nodes[Math.min(last, i + 1)] ?? n;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    // the side of the spine that faces away from Notra's front
    let nx = -dy / length;
    let ny = dx / length;
    if (nx * back < 0) {
      nx = -nx;
      ny = -ny;
    }
    const w = CAPE_WIDTH[0] + (CAPE_WIDTH[1] - CAPE_WIDTH[0]) * (i / last);
    return {
      middle: { x: n.x + nx * w * 0.45, y: n.y + ny * w * 0.45 },
      inner: { x: n.x - nx * w * 0.1, y: n.y - ny * w * 0.1 },
      fold: { x: n.x + nx * w * 0.25, y: n.y + ny * w * 0.25 },
      outer: { x: n.x + nx * w, y: n.y + ny * w },
    };
  });
  const quad = (a: Vec, b: Vec, c: Vec, d: Vec, color: Rgb) => {
    for (const v of [a, b, c, a, c, d]) {
      paint.vertex(v, color, 1);
    }
  };
  const { cloth, fold, trim, vane, quill } = theme.cape;
  for (let i = 0; i < last; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    if (!(a && b)) {
      continue;
    }
    quad(a.inner, a.outer, b.outer, b.inner, cloth);
    if (i === 1) {
      quad(a.inner, a.fold, b.fold, b.inner, fold);
    }
  }
  // the hem: the bottom of the last link in the trim colour
  const top = edges[last - 1];
  const hem = edges[last];
  if (top && hem) {
    const t = 1 - CAPE_HEM * last;
    const at = (from: Vec, to: Vec) => ({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
    quad(
      at(top.inner, hem.inner),
      at(top.outer, hem.outer),
      hem.outer,
      hem.inner,
      trim
    );
  }

  const clasp = nodes[0];
  if (clasp) {
    paint.dot(clasp, paint.u * 1.2, trim);
  }
  // the feather stays upright on the pixel grid while the cloth swings, so it never smears
  const { u } = paint;
  const logo = edges[Math.round(last * CAPE_LOGO_AT)];
  if (logo) {
    const centre = snap(logo.middle);
    const half = (CAPE_LOGO.length - 1) / 2;
    CAPE_LOGO.forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell !== ".") {
          paint.dot(
            { x: centre.x + (c - half) * u, y: centre.y - (r - half) * u },
            u * 0.45,
            cell === "q" ? quill : vane
          );
        }
      });
    });
  }
}

/** A stick figure with a big round head and one almond eye, white pupil included, looking the way it faces. */
function figure(paint: Painter, f: Fighter, theme: DuelTheme) {
  const { u } = paint;
  const p = f.pose;
  limbs(paint, p, theme.body, theme.bodyBack, u * 1.2);
  const eye = {
    x: p.head.x + f.face.x * HEAD_R * 0.35,
    y: p.head.y + HEAD_R * 0.1,
  };
  const half = u * Math.abs(f.face.x) * 0.8;
  paint.capsule(
    { x: eye.x - half, y: eye.y },
    { x: eye.x + half, y: eye.y },
    u * 1.1,
    theme.eye
  );
  paint.dot({ x: eye.x + f.face.x * u * 0.4, y: eye.y }, u * 0.5, theme.body);
  paint.capsule(p.pommel, p.base, u * 1.4, theme.hilt);
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** On a light page a saber glows lighter, unless it brings its own light colours. */
function themedBlade(blade: DuelBlade, theme: DuelTheme): DuelBlade {
  if (!theme.light) {
    return blade;
  }
  return blade.light ?? { ...blade, glow: mix(blade.band, WHITE_RGB, 0.55) };
}

/** Trails and afterimages: the blade colour on a dark page, its paler glow on a light one so they never smudge. */
function streak(blade: DuelBlade, theme: DuelTheme): Rgb {
  const themed = themedBlade(blade, theme);
  return theme.light ? themed.glow : themed.band;
}

interface Saber {
  base: Vec;
  tip: Vec;
  blade: DuelBlade;
  /** Right after a clash the glow flares up. */
  hot: boolean;
}

const lit = (f: Fighter) => f.ext.x > 0.03;

/** Fills `frame` from the engine for a target where one art pixel is `pixelCss` css pixels. */
export function buildDuelFrame(
  frame: DuelFrame,
  engine: DuelEngine,
  pixelCss: number,
  theme: DuelTheme
) {
  const u = pixelCss / engine.scale;
  const paint = new Painter(frame, u);
  frame.view = { scale: engine.scale, floorY: engine.ground };
  frame.px = u;
  frame.count = 0;
  frame.ribbonCount = 0;

  const sabers: Saber[] = [];
  for (const f of engine.fighters) {
    if (lit(f)) {
      sabers.push({
        base: f.pose.base,
        tip: f.pose.tip,
        blade: themedBlade(f.blade, theme),
        hot: f.heat > 0.55,
      });
    }
  }

  // floor light
  frame.bladeSeg.fill(0);
  frame.bladeCol.fill(0);
  sabers.slice(0, MAX_BLADE_LIGHTS).forEach((s, i) => {
    frame.bladeSeg.set([s.base.x, s.base.y, s.tip.x, s.tip.y], i * 4);
    const { glow } = s.blade;
    frame.bladeCol.set([glow[0] / 255, glow[1] / 255, glow[2] / 255, 1], i * 4);
  });

  // the centre of the art pixel a point falls in; pixels are counted from the canvas's top left corner
  const snap = (p: Vec): Vec => {
    const half = engine.width / 2;
    const column = Math.floor((half + p.x * engine.scale) / pixelCss);
    const row = Math.floor((engine.ground - p.y * engine.scale) / pixelCss);
    return {
      x: ((column + 0.5) * pixelCss - half) / engine.scale,
      y: (engine.ground - (row + 0.5) * pixelCss) / engine.scale,
    };
  };
  for (const f of engine.fighters) {
    capeCloth(paint, f, theme, snap);
  }

  // trails: the swept area near the tip, dithered thinner as it ages
  for (const f of engine.fighters) {
    if (!lit(f)) {
      continue;
    }
    const samples = f.trail;
    const band = streak(f.blade, theme);
    const n = samples.length;
    for (let i = 0; i < n - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (!(a && b)) {
        continue;
      }
      const ka = 0.45 * (1 - i / n) ** 2;
      const kb = 0.45 * (1 - (i + 1) / n) ** 2;
      paint.vertex(a.b, band, 0);
      paint.vertex(a.t, band, ka);
      paint.vertex(b.t, band, kb);
      paint.vertex(a.b, band, 0);
      paint.vertex(b.t, band, kb);
      paint.vertex(b.b, band, 0);
    }
  }

  // behind the fighters: blade glow, cuts in the floor, afterimages
  for (const s of sabers) {
    const flare = theme.light ? s.blade.glow : s.blade.band;
    paint.glow(
      s.base,
      s.tip,
      u * (s.hot ? 7 : 5),
      s.hot ? flare : s.blade.glow,
      s.hot ? 1.3 : 1.1
    );
  }
  for (const scorch of engine.scorches) {
    const k = scorch.life / scorch.max;
    const c =
      theme.sparks[Math.min(theme.sparks.length - 2, Math.floor(k * 3))] ??
      WHITE_RGB;
    paint.capsule(
      { x: scorch.x - (scorch.w / 2) * k, y: -u },
      { x: scorch.x + (scorch.w / 2) * k, y: -u },
      u * 0.6,
      c
    );
  }
  for (const f of engine.fighters) {
    for (const ghost of f.ghosts) {
      const k = ghost.life / ghost.max;
      limbs(
        paint,
        ghost.pose,
        streak(f.blade, theme),
        streak(f.blade, theme),
        u * 1.2,
        DITHER,
        0.55 * k
      );
    }
  }

  // the fighters and their sabers
  for (const f of engine.fighters) {
    figure(paint, f, theme);
  }
  for (const s of sabers) {
    paint.capsule(s.base, s.tip, u * 2.1, s.blade.band);
  }
  for (const s of sabers) {
    paint.capsule(s.base, s.tip, u * 1.05, s.blade.core);
  }

  // hits on top
  for (const spark of engine.sparks) {
    const k = spark.life / spark.max;
    const c =
      theme.sparks[
        clamp(Math.floor(k * theme.sparks.length), 0, theme.sparks.length - 1)
      ] ?? WHITE_RGB;
    paint.capsule(
      spark,
      { x: spark.x - spark.vx * 0.008, y: spark.y - spark.vy * 0.008 },
      u * 0.5,
      c
    );
  }
  if (engine.contact) {
    paint.dot(engine.contact, u * 2, WHITE_RGB);
  }
  for (const flash of engine.flashes) {
    // a cartoon impact star: long spikes on the axes, short ones on the diagonals, around a white core
    const k = flash.life / flash.max;
    const c = flash.rgb ?? WHITE_RGB;
    const reach = flash.r * 0.24 * Math.sqrt(k);
    DIRECTIONS.forEach((d, i) => {
      const length = reach * (i % 2 ? 0.5 : 1);
      const from = {
        x: flash.x + d.x * reach * 0.25,
        y: flash.y + d.y * reach * 0.25,
      };
      paint.capsule(
        from,
        { x: flash.x + d.x * length, y: flash.y + d.y * length },
        u * 0.9,
        c
      );
    });
    paint.dot(flash, u * (1 + 2.2 * flash.r * k), WHITE_RGB);
  }
  for (const ring of engine.rings) {
    const k = ring.life / ring.max;
    const r = ring.r * (1 - k * k * 0.85);
    if (ring.floor) {
      // dust kicked out along the floor
      for (const side of [-1, 1]) {
        paint.glow(
          { x: ring.x + side * r * 0.5, y: u * 3 },
          { x: ring.x + side * r * 0.5, y: u * 3 },
          u * 6 * k + u,
          theme.bodyBack,
          0.9 * k
        );
      }
    } else {
      paint.ring(
        ring,
        r * 0.4,
        u,
        ring.rgb === CLASH_RGB ? theme.clash : ring.rgb
      );
    }
  }
}
