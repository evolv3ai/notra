import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { BlogPostTocProps, TocSection } from "~types/blog";

import {
  TOC_DEPTHS,
  TOC_SCROLL_LOCK_FALLBACK_MS,
  TOC_SCROLL_OFFSET_PX,
  TOC_STICKY_OFFSET_PX,
} from "@/lib/blog/constants";
import {
  buildTocSections,
  getHeadingId,
  scrollToHeading,
  scrollToTop,
} from "@/lib/blog/toc";

const TOC_LINK_CLASS =
  "flex gap-2 py-1.25 font-sans text-sm leading-snug transition-colors before:mt-[0.05em] before:h-[0.55em] before:w-[0.5em] before:shrink-0 before:border-b before:border-l before:content-[''] before:transition-colors";
const TOC_LINK_IDLE_CLASS =
  "text-muted-foreground hover:text-foreground before:border-muted-foreground/50";
const TOC_LINK_ACTIVE_CLASS = "text-foreground before:border-foreground";

export function BlogPostToc({ toc }: BlogPostTocProps) {
  const items = useMemo(
    () =>
      toc.filter((item) =>
        (TOC_DEPTHS as readonly number[]).includes(item.depth)
      ),
    [toc]
  );
  const sections: TocSection[] = useMemo(
    () => buildTocSections(items),
    [items]
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const scrollLockRef = useRef(false);
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function lockScrollSpy() {
    scrollLockRef.current = true;
    if (scrollLockTimerRef.current) {
      clearTimeout(scrollLockTimerRef.current);
    }
    scrollLockTimerRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, TOC_SCROLL_LOCK_FALLBACK_MS);
  }

  useEffect(() => {
    function update() {
      const nav = navRef.current;
      if (!nav) {
        return;
      }
      setHasScrolled(nav.getBoundingClientRect().top <= TOC_STICKY_OFFSET_PX);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    function handleScrollEnd() {
      scrollLockRef.current = false;
      if (scrollLockTimerRef.current) {
        clearTimeout(scrollLockTimerRef.current);
        scrollLockTimerRef.current = null;
      }
    }
    if (!("onscrollend" in window)) {
      return;
    }
    window.addEventListener("scrollend", handleScrollEnd);
    return () => window.removeEventListener("scrollend", handleScrollEnd);
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }
    const headings = items
      .map((item) => document.getElementById(getHeadingId(item)))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) {
      return;
    }

    function update() {
      if (scrollLockRef.current) {
        return;
      }
      const scrollY = window.scrollY + TOC_SCROLL_OFFSET_PX + 8;
      let current: string | null = headings[0]?.id ?? null;
      for (const heading of headings) {
        if (heading.offsetTop <= scrollY) {
          current = heading.id;
        } else {
          break;
        }
      }
      setActiveId(current);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  const expandedId =
    sections.find(
      (section) =>
        section.id === activeId ||
        section.children.some((child) => child.id === activeId)
    )?.id ?? null;

  function handleClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    lockScrollSpy();
    setActiveId(id);
    scrollToHeading(id);
  }

  return (
    <nav aria-label="On this page" className="not-prose" ref={navRef}>
      <p className="text-muted-foreground mb-3 font-mono text-xs tracking-wider uppercase">
        On this page
      </p>
      <ol className="flex flex-col">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              className={`${TOC_LINK_CLASS} ${
                section.id === activeId
                  ? TOC_LINK_ACTIVE_CLASS
                  : TOC_LINK_IDLE_CLASS
              }`}
              href={section.url}
              onClick={(event) => handleClick(event, section.id)}
            >
              {section.title}
            </a>
            {section.children.length > 0 ? (
              <div
                className={`grid motion-reduce:transition-none ${
                  expandedId === section.id
                    ? "visible grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-200 ease-out"
                    : "invisible grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,visibility] [transition-delay:0s,0s,200ms] duration-200 ease-out focus-within:visible focus-within:grid-rows-[1fr] focus-within:opacity-100"
                }`}
              >
                <ol className="flex min-h-0 flex-col overflow-hidden pl-4.5">
                  {section.children.map((child) => (
                    <li key={child.id}>
                      <a
                        className={`${TOC_LINK_CLASS} ${
                          child.id === activeId
                            ? TOC_LINK_ACTIVE_CLASS
                            : TOC_LINK_IDLE_CLASS
                        }`}
                        href={child.url}
                        onClick={(event) => handleClick(event, child.id)}
                      >
                        {child.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {hasScrolled ? (
        <button
          className="border-border/70 text-muted-foreground hover:text-foreground mt-6 flex w-full cursor-pointer items-center gap-2 border-t pt-4 font-sans text-sm font-medium transition-colors"
          onClick={scrollToTop}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={ArrowUp01Icon} />
          Back to top
        </button>
      ) : null}
    </nav>
  );
}
