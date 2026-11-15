export type Rgb = readonly [number, number, number];

export interface NukeDamage {
  index: number;
  color: Rgb;
  distance: number;
  restoreAt: number;
}

export interface NukeParticle {
  kind: "debris" | "fire" | "smoke";
  x: number;
  y: number;
  vx: number;
  vy: number;
  spread: number;
  drag: number;
  gravity: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  color: Rgb;
}
