"use client";

import { useLayoutEffect, useRef, useState } from "react";

import type {
  OnboardingPreviewLensState,
  UseOnboardingPreviewLensInput,
} from "@/types/onboarding";
import { onboardingPreviewLens } from "@/utils/onboarding";

export function useOnboardingPreviewLens({
  viewport,
  lensContent,
  focus,
  scale,
  page,
}: UseOnboardingPreviewLensInput) {
  const [lens, setLens] = useState<OnboardingPreviewLensState>({
    transform: "none",
    width: 0,
    height: 0,
    focus: null,
    glide: false,
  });
  const visible = Boolean(scale) && focus !== null && lens.focus === focus;
  const shownRef = useRef(visible);

  useLayoutEffect(() => {
    shownRef.current = visible;
  }, [visible]);

  useLayoutEffect(() => {
    const target =
      viewport && focus
        ? viewport.querySelector(`[data-zoom~="${focus}"]`)
        : null;
    if (!(viewport && lensContent && target && scale)) {
      return;
    }
    const update = () => {
      lensContent.replaceChildren(target.cloneNode(true));
      setLens({
        ...onboardingPreviewLens(viewport, target, scale),
        focus,
        glide: shownRef.current,
      });
    };
    const frameId = requestAnimationFrame(update);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(viewport);
    resizeObserver.observe(target);
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(target, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [viewport, lensContent, focus, scale, page]);

  return { ...lens, visible, glide: visible && lens.glide };
}
