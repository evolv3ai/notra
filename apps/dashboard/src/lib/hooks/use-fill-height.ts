"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { TABLE_FRAME_INSET_PX } from "ui/table/constants";

function remainingTableHeight(element: HTMLElement): number {
  const elementTop = element.getBoundingClientRect().top;
  const page = element.closest("[data-geo-gaps-page]");
  const pagePadding =
    page instanceof HTMLElement
      ? Number.parseFloat(getComputedStyle(page).paddingBottom)
      : Number.NaN;
  const inset = Number.isFinite(pagePadding) ? pagePadding : 24;

  let pageAvailable = 0;
  if (page instanceof HTMLElement) {
    pageAvailable = page.getBoundingClientRect().bottom - inset - elementTop;
  }

  let scrollAvailable = 0;
  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") {
      scrollAvailable =
        parent.getBoundingClientRect().bottom - inset - elementTop;
      break;
    }
    parent = parent.parentElement;
  }

  return (
    Math.max(element.clientHeight, pageAvailable, scrollAvailable) -
    TABLE_FRAME_INSET_PX
  );
}

/** Height that lets a table fill the rest of the GEO gaps page. */
export function useFillHeight(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      const next = Math.floor(remainingTableHeight(element));
      if (next > 0) {
        setHeight((current) => (current === next ? current : next));
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const page = element.closest("[data-geo-gaps-page]");
    if (page instanceof HTMLElement) {
      observer.observe(page);
    }
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return [ref, height] as const;
}
