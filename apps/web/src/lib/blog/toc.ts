import type { TOCItemType } from "fumadocs-core/toc";
import type { TocSection } from "~types/blog";

import { TOC_SCROLL_OFFSET_PX } from "@/lib/blog/constants";

export function getHeadingId(item: TOCItemType) {
  return item.url.startsWith("#") ? item.url.slice(1) : item.url;
}

export function scrollToHeading(id: string) {
  const target = document.getElementById(id);
  if (!target) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const top = rect.top + window.scrollY - TOC_SCROLL_OFFSET_PX;
  window.scrollTo({ top, behavior: "smooth" });
  if (typeof history !== "undefined") {
    history.replaceState(null, "", `#${id}`);
  }
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (typeof history !== "undefined") {
    history.replaceState(null, "", window.location.pathname);
  }
}

export function buildTocSections(items: TOCItemType[]) {
  const sections: TocSection[] = [];
  for (const item of items) {
    const entry = {
      id: getHeadingId(item),
      url: item.url,
      title: item.title,
    };
    const last = sections.at(-1);
    if (item.depth === 3 && last) {
      last.children.push(entry);
    } else {
      sections.push({ ...entry, children: [] });
    }
  }
  return sections;
}
