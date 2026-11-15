import { useEffect, useRef } from "react";

import { DUEL_STILL_S } from "@/constants/compare/duel";
import { DuelEngine } from "@/lib/compare-duel/engine";
import { DuelGl } from "@/lib/compare-duel/gl";
import type { DuelCanvasOptions } from "@/types/compare-duel";

const STILL_STEP_S = 1 / 60;

/**
 * Runs the duel on a canvas inside `stageRef`. It only animates while the stage is on screen and the tab
 * is open; under reduced motion it draws one still frame instead. If the GPU drops the WebGL context it
 * stops, then rebuilds the renderer once the context comes back.
 */
export function useDuelCanvas({ theme, reducedMotion }: DuelCanvasOptions) {
  const stageRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme);
  const redrawRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    themeRef.current = theme;
    redrawRef.current();
  }, [theme]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    // a fresh canvas each time, since a canvas keeps whichever context type it was first given
    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 size-full";
    canvas.setAttribute("aria-hidden", "true");
    stage.prepend(canvas);
    let renderer = DuelGl.create(canvas);
    if (!renderer) {
      canvas.remove();
      return;
    }

    const engine = new DuelEngine(reducedMotion);
    let visible = false;
    let frame = 0;
    let last = 0;
    let settled = !reducedMotion;

    const draw = () => renderer?.render(engine, themeRef.current);
    const running = () =>
      renderer !== null && !reducedMotion && visible && !document.hidden;
    const tick = (now: number) => {
      engine.simulate(Math.min(0.05, (now - last) / 1000));
      last = now;
      draw();
      frame = running() ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (frame || !running()) {
        return;
      }
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    redrawRef.current = () => {
      if (!frame) {
        draw();
      }
    };

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer?.resize(
        width,
        height,
        Math.min(window.devicePixelRatio || 1, 2)
      );
      engine.resize(width, height);
      // the still frame needs a real layout, so it waits for the first non-empty size
      if (!settled && width > 0 && height > 0) {
        settled = true;
        for (let t = 0; t < DUEL_STILL_S; t += STILL_STEP_S) {
          engine.simulate(STILL_STEP_S);
        }
      }
      if (!frame) {
        draw();
      }
    };
    resize();

    const contextLost = (event: Event) => {
      // without preventDefault the browser never restores the context
      event.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      renderer = null;
    };
    const contextRestored = () => {
      renderer = DuelGl.create(canvas);
      resize();
      wake();
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      wake();
    });
    visibility.observe(stage);
    document.addEventListener("visibilitychange", wake);

    return () => {
      cancelAnimationFrame(frame);
      redrawRef.current = () => undefined;
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", wake);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      renderer?.dispose();
      canvas.remove();
    };
  }, [reducedMotion]);

  return stageRef;
}
