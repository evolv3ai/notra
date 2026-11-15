import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { DitherVisibilityState } from "@/types/dithering";
import {
  getDitherEnvironmentServerSnapshot,
  getDitherMobileServerSnapshot,
  getDitherMobileSnapshot,
  getFirstInteractionSnapshot,
  getPageVisibleSnapshot,
  subscribeToDitherViewport,
  subscribeToFirstInteraction,
  subscribeToPageVisibility,
} from "@/utils/dither-environment";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  subscribeToReducedMotion,
} from "@/utils/reduced-motion";

const VIEWPORT_MARGIN = "200px";

export function useDitherVisibility(
  unmountOffscreen = false,
  eager = false
): DitherVisibilityState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const isMobile = useSyncExternalStore(
    subscribeToDitherViewport,
    getDitherMobileSnapshot,
    getDitherMobileServerSnapshot
  );
  const isPageVisible = useSyncExternalStore(
    subscribeToPageVisibility,
    getPageVisibleSnapshot,
    getDitherEnvironmentServerSnapshot
  );
  const hasInteracted = useSyncExternalStore(
    subscribeToFirstInteraction,
    getFirstInteractionSnapshot,
    getDitherEnvironmentServerSnapshot
  );
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setIsInView(visible);
        if (visible) {
          setHasEntered(true);
        }
      },
      { rootMargin: VIEWPORT_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const renderEagerly = eager && !isMobile;

  return {
    containerRef,
    shouldRender:
      !prefersReducedMotion &&
      hasInteracted &&
      (renderEagerly ||
        (unmountOffscreen ? isInView && isPageVisible : hasEntered)),
    isAnimating: isInView && isPageVisible && !prefersReducedMotion,
  };
}
