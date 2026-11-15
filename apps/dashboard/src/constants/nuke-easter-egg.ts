import type { Rgb } from "@/types/nuke-easter-egg";

export const NUKE_CLICKS = 5;
export const NUKE_CLICK_WINDOW_MS = 1000;

export const NUKE_PIXEL_SIZE = 5;
export const NUKE_FALL_MS = 1000;
export const NUKE_SHOCKWAVE_MS = 1100;
export const NUKE_FLASH_MS = 450;
export const NUKE_SHAKE_MS = 1000;
export const NUKE_SHAKE_PX = 18;
export const NUKE_SMOKE_SPAWN_MS = 1400;
export const NUKE_RUBBLE_MS = 4200;
export const NUKE_MIN_RUBBLE_MS = 1200;
export const NUKE_REBUILD_MS = 1400;
export const NUKE_FADE_MS = 500;

export const NUKE_IMPACT = { x: 0.5, y: 0.6 } as const;
export const NUKE_CRATER_RATIO = 0.15;
export const NUKE_SCORCH_RATIO = 2.8;
export const NUKE_CRACKS = 9;
export const NUKE_DEBRIS = 260;
export const NUKE_FIRE = 240;
export const NUKE_SMOKE = 420;

export const NUKE_COLORS = {
  crack: [16, 14, 12],
  craterDeep: [20, 15, 12],
  craterFloor: [44, 33, 26],
  ember: [255, 122, 26],
  rim: [84, 58, 40],
  rimDark: [58, 40, 29],
  shadow: [0, 0, 0],
  smokeDark: [52, 50, 52],
  smokeLight: [150, 146, 142],
  soot: [24, 22, 22],
} as const satisfies Record<string, Rgb>;

export const NUKE_FIRE_RAMP: readonly Rgb[] = [
  [255, 255, 236],
  [255, 236, 128],
  [255, 170, 51],
  [240, 96, 32],
  [176, 40, 24],
  [70, 52, 48],
];

export const NUKE_BOMB_SPRITE = [
  "kk.....kk",
  "kkk.k.kkk",
  ".kkkkkkk.",
  "..kkkkk..",
  "...kkk...",
  "..kdddk..",
  ".kdgggdk.",
  ".kgggggk.",
  "kdgwgggdk",
  "kdgwgggdk",
  "kdgwgggdk",
  "krrrrrrrk",
  "kdgggggdk",
  ".kdgggdk.",
  ".kddgddk.",
  "..kdddk..",
  "...kdk...",
  "....k....",
];

export const NUKE_BOMB_PALETTE: Record<string, string> = {
  d: "#3a3f47",
  g: "#5b6470",
  k: "#111317",
  r: "#e5484d",
  w: "#a3acb6",
};
