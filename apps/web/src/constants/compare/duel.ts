import type {
  DuelBlade,
  DuelLayout,
  DuelTheme,
  Rgb,
  Strike,
  StrikeName,
} from "@/types/compare-duel";

export const TAU = Math.PI * 2;

// Lengths are in figure units: 1 is about the height of a stick figure, y points up, the floor is at 0.
export const THIGH = 0.25;
export const SHIN = 0.25;
export const TORSO = 0.31;
export const NECK = 0.05;
export const HEAD_R = 0.095;
export const UPPER = 0.19;
export const FORE = 0.18;
export const REACH = UPPER + FORE;
export const HILT = 0.1;
export const BLADE = 0.7;
export const DIST = 1.22;
export const GRAVITY = 9.5;

// Pixel-art palette: flat colours only.
export const WHITE_RGB: Rgb = [255, 255, 255];
/** Clash rings are a warm white. */
export const CLASH_RGB: Rgb = [255, 250, 240];

/** Notra's saber is emerald, like the first duel, so it stands apart from the violet figures and every vendor. */
export const NOTRA_BLADE: DuelBlade = {
  band: [52, 211, 153],
  core: WHITE_RGB,
  glow: [4, 120, 87],
  light: { band: [5, 150, 105], core: [236, 253, 245], glow: [110, 231, 183] },
};

/** Every vendor fights with a red saber, so green against red always tells the two apart. */
export const RIVAL_BLADE: DuelBlade = {
  band: [239, 68, 68],
  core: WHITE_RGB,
  glow: [153, 27, 27],
  light: { band: [220, 38, 38], core: [254, 242, 242], glow: [252, 165, 165] },
};

// Notra's cape: a chain hanging from the shoulders that gravity pulls down and a steady draught blows back.
export const CAPE_LINKS = 5;
export const CAPE_LINK = 0.11;
/** Backward pull on the cape, against the way Notra faces. */
export const CAPE_FLOW = 2.5;
/** How quickly a swinging cape settles, per second. */
export const CAPE_DRAG = 1.6;
/** The Notra feather on the cape, traced from the mark one character per art pixel: `q` is the quill and outline, `v` the vane. */
export const CAPE_LOGO = [
  ".....qqqq",
  "....qqvvq",
  "...qqvvvq",
  "..qvvvvqq",
  ".qqvvvqq.",
  ".qvvvvq..",
  "qqqqq....",
  "q........",
  "q........",
];
/** The logo's colours, the same as the mark on the site. */
const LOGO_VANE: Rgb = [237, 228, 255];
const LOGO_QUILL: Rgb = [30, 30, 30];

// Local angles: 0 points at the opponent, π/2 straight up. Every angle lives in [-π/2, 3π/2)
// so blades swing over the top instead of through the floor, except `rising`.
export const STRIKES: Record<StrikeName, Strike> = {
  high: {
    h: 0.98,
    wind: [-0.04, 0.24],
    wa: 2.35,
    ca: 0.45,
    over: -0.45,
    block: 1.15,
    crouch: 0.45,
  },
  mid: {
    h: 0.72,
    wind: [-0.08, 0.06],
    wa: 1.95,
    ca: -0.05,
    over: -0.45,
    block: 1.35,
    crouch: 0.3,
  },
  low: {
    h: 0.34,
    wind: [0, 0.2],
    wa: 1.25,
    ca: -0.7,
    over: -0.4,
    block: -1.2,
    crouch: 0.6,
  },
  thrust: {
    h: 0.72,
    wind: [-0.1, -0.1],
    wa: 0.2,
    ca: 0.08,
    over: 0,
    push: 0.1,
    block: 0.85,
    crouch: 0.3,
  },
  rising: {
    h: 0.8,
    wind: [-0.1, -0.28],
    wa: 4.25,
    ca: 1.17 + TAU,
    over: 0.4,
    block: 0.1,
    crouch: 0.25,
  },
};
export const STRIKE_NAMES = Object.keys(STRIKES) as StrikeName[];

/** Light mode: violet figures that sit in the hero's dither instead of on top of it. */
export const LIGHT_BACKDROP_THEME: DuelTheme = {
  edge: [196, 178, 240],
  body: [98, 66, 190],
  bodyBack: [160, 136, 226],
  hilt: [118, 98, 170],
  eye: [239, 234, 253],
  cape: {
    cloth: [124, 58, 237],
    fold: [76, 29, 149],
    trim: [250, 204, 21],
    vane: LOGO_VANE,
    quill: LOGO_QUILL,
  },
  clash: WHITE_RGB,
  sparks: [
    [194, 65, 12],
    [234, 88, 12],
    [251, 146, 60],
    [250, 204, 21],
  ],
  light: true,
};

/** Dark mode: the same in pale lavender on the dark wash. */
export const DARK_BACKDROP_THEME: DuelTheme = {
  edge: [78, 64, 120],
  body: [221, 210, 252],
  bodyBack: [140, 122, 196],
  hilt: [150, 138, 190],
  eye: [42, 33, 64],
  cape: {
    cloth: [139, 92, 246],
    fold: [91, 33, 182],
    trim: [253, 224, 71],
    vane: LOGO_VANE,
    quill: LOGO_QUILL,
  },
  clash: CLASH_RGB,
  sparks: [
    [194, 65, 12],
    [251, 146, 60],
    [253, 224, 71],
    [255, 255, 255],
  ],
  light: false,
};

/** The figures are this tall and stand this low, as fractions of the strip they fight in. */
export const DUEL_LAYOUT: DuelLayout = { scale: 0.45, ground: 0.9 };

/** Each vendor gets a bout of this many seconds before Notra finishes it. */
export const DUEL_BOUT_S: readonly [number, number] = [6, 8];

/** Under reduced motion the duel is simulated this far and shown as a still. */
export const DUEL_STILL_S = 5.2;

/** How far from the middle the fighters may stray, in figure units. */
export const DUEL_STAGE_HALF_WIDTH = 1.1;
