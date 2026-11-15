"use client";

import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

import { SITE_CREATE_SCROLL_FADE_REM } from "@/constants/site-create";
import type { SiteCreateScrollListProps } from "@/types/components/sites";

export function SiteCreateScrollList({ children }: SiteCreateScrollListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = () => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
    );
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  });

  return (
    <div
      className="col-start-2 -m-0.5 max-h-60 space-y-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_var(--fade-top),black_calc(100%_-_var(--fade-bottom)),transparent)] p-0.5"
      onScroll={measure}
      ref={ref}
      style={
        {
          "--fade-top": edges.top ? `${SITE_CREATE_SCROLL_FADE_REM}rem` : "0px",
          "--fade-bottom": edges.bottom
            ? `${SITE_CREATE_SCROLL_FADE_REM}rem`
            : "0px",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
