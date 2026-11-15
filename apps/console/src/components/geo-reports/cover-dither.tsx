"use client";

import { Dithering } from "@paper-design/shaders-react";
import { useReducedMotion } from "motion/react";

import type { CoverDitherProps } from "@/types/geo-report";

const DITHER_CELL_PX = 2;
const DITHER_SPEED = 0.35;
// The wave shape fades along its y axis; rotating it 90° makes the fade run
// left → right, and scale ≈ 1.4 stretches that fade across the canvas width.
const DITHER_ROTATION = 90;
const DITHER_SCALE = 1.4;

/**
 * Paper's dithering shader (8×8 Bayer) as a full-bleed field: solid `color`
 * at the left edge dissolving into transparency toward the right.
 */
export function CoverDither({ color, className }: CoverDitherProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Dithering
      className={className}
      colorBack="#00000000"
      colorFront={color}
      fit="contain"
      rotation={DITHER_ROTATION}
      scale={DITHER_SCALE}
      shape="wave"
      size={DITHER_CELL_PX}
      speed={reduceMotion ? 0 : DITHER_SPEED}
      style={{ width: "100%", height: "100%" }}
      type="8x8"
    />
  );
}
