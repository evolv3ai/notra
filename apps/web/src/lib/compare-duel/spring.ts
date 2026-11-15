/** A damped spring that eases `x` toward the target `t`. */
export class Spring {
  x: number;
  v = 0;
  t: number;
  w: number;
  z: number;

  constructor(x: number, w = 12, z = 0.85) {
    this.x = x;
    this.t = x;
    this.w = w;
    this.z = z;
  }

  set(t: number, w?: number, z?: number) {
    this.t = t;
    if (w !== undefined) {
      this.w = w;
    }
    if (z !== undefined) {
      this.z = z;
    }
  }

  step(h: number) {
    this.v +=
      (this.w * this.w * (this.t - this.x) - 2 * this.z * this.w * this.v) * h;
    this.x += this.v * h;
  }
}
