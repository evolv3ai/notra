import type { Spring } from "@/lib/compare-duel/spring";

export interface Vec {
  x: number;
  y: number;
}

export type Rgb = readonly [number, number, number];

export type DuelPhase = "intro" | "fight" | "lock" | "finale";

/** Choreography steps yield how many seconds to wait before the next step. */
export type DuelScript = Generator<number, void, void>;

export type StrikeName = "high" | "mid" | "low" | "thrust" | "rising";

/** How an attack is delivered: a plain strike, turning through a full spin first, or a quick flurry hit. */
export type StrikeStyle = "plain" | "spin" | "flurry";

/** The colours of one saber: the outer band, the bright core and the dithered glow around it. */
export interface DuelBlade {
  band: Rgb;
  core: Rgb;
  glow: Rgb;
  /** Colours to use instead on a light page; without them the glow is mixed lighter. */
  light?: DuelBlade;
}

/** Notra's pixel cape: a cloth with a darker fold under the collar, a clasp and hem in the trim colour, and the Notra feather. */
interface DuelCape {
  cloth: Rgb;
  fold: Rgb;
  trim: Rgb;
  vane: Rgb;
  quill: Rgb;
}
/** The duel is painted straight onto the page: only the floor edge and the pools of saber light fill the floor. */
export interface DuelTheme {
  edge: Rgb;
  body: Rgb;
  bodyBack: Rgb;
  hilt: Rgb;
  /** The almond eye is cut out in this colour. */
  eye: Rgb;
  cape: DuelCape;
  clash: Rgb;
  /** Sparks cool down through these, hottest last. */
  sparks: Rgb[];
  light: boolean;
}

export interface DuelCanvasOptions {
  theme: DuelTheme;
  reducedMotion: boolean;
}

/** Fractions of the canvas height: how big a figure unit is and where the floor sits. */
export interface DuelLayout {
  scale: number;
  ground: number;
}

export interface Strike {
  /** Height of the clash point above the floor. */
  h: number;
  /** Hand position during the windup, relative to the shoulder. */
  wind: readonly [number, number];
  /** Blade angle during the windup. */
  wa: number;
  /** Blade angle at contact. */
  ca: number;
  /** How far past the contact angle the swing keeps pushing. */
  over: number;
  /** Extra forward reach for thrusts. */
  push?: number;
  /** Defender blade angle. */
  block: number;
  /** Defender crouch. */
  crouch: number;
}

export interface Foot {
  x: number;
  lift: number;
  x0: number;
  x1: number;
  st: number;
  dur: number;
}

export interface Pose {
  hip: Vec;
  neck: Vec;
  head: Vec;
  sh: Vec;
  elbow: Vec;
  hand: Vec;
  pommel: Vec;
  base: Vec;
  tip: Vec;
  offElbow: Vec;
  offHand: Vec;
  knees: Vec[];
  feet: Vec[];
}

/** One link of a cape, moved by verlet integration: `px`/`py` hold where it was one step ago. */
export interface CapeNode extends Vec {
  px: number;
  py: number;
}
interface Ghost {
  pose: Pose;
  life: number;
  max: number;
}

export interface Fighter {
  blade: DuelBlade;
  x: Spring;
  face: Spring;
  crouch: Spring;
  lean: Spring;
  hx: Spring;
  hy: Spring;
  ang: Spring;
  ext: Spring;
  ox: Spring;
  oy: Spring;
  air: Spring;
  y: number;
  yv: number;
  xvAir: number;
  airT: number;
  airDur: number;
  flip: number;
  rot: number;
  airborne: boolean;
  feet: Foot[];
  twoHand: boolean;
  gripOff: Vec;
  /** Extra glow right after a clash, decays to 0. */
  heat: number;
  /** While positive the fighter keeps its facing, so it can turn its back during a spin. */
  turnLock: number;
  ghosts: Ghost[];
  ghostClock: number;
  trail: { b: Vec; t: Vec }[];
  /** Empty for a fighter without a cape. */
  cape: CapeNode[];
  pose: Pose;
  prev: {
    x: number;
    crouch: number;
    lean: number;
    face: number;
    hx: number;
    hy: number;
    ang: number;
  } | null;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export interface Flash {
  x: number;
  y: number;
  life: number;
  max: number;
  r: number;
  rgb?: Rgb;
}

export interface Ring {
  x: number;
  y: number;
  life: number;
  max: number;
  r: number;
  rgb: Rgb;
  /** Rings on the floor are squashed into ellipses. */
  floor: boolean;
}

export interface Scorch {
  x: number;
  w: number;
  life: number;
  max: number;
}

export interface Contact {
  x: number;
  y: number;
  life: number;
}

/** How the world maps to the screen. */
interface DuelView {
  /** Pixels per figure unit. */
  scale: number;
  /** Screen y of the floor, in css pixels. */
  floorY: number;
}

/** Everything the GPU needs for one frame: capsules in draw order, trail triangles and floor lights. */
export interface DuelFrame {
  data: Float32Array;
  count: number;
  /** Trail triangles, RIBBON_FLOATS per vertex. */
  ribbon: Float32Array;
  ribbonCount: number;
  bladeSeg: Float32Array;
  bladeCol: Float32Array;
  view: DuelView;
  /** World units per art pixel on screen right now. */
  px: number;
}
