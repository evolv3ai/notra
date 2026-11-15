import { useRouterState } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";

import { SITE_DESIGN_SECTIONS } from "@/constants/site-design-sections";
export function useSiteDesignSection() {
  const [selected, setSection] = useQueryState(
    "section",
    parseAsString.withDefault("general")
  );
  // The section of the page being rendered: while a link to another section
  // loads, the committed URL still names the old one, which would light up
  // the wrong sidebar row next to the new page's skeleton.
  const rendered = useRouterState({
    select: (state) => {
      const search = state.matches.at(-1)?.search as
        | Record<string, unknown>
        | undefined;
      return typeof search?.section === "string" ? search.section : null;
    },
  });
  const id = rendered ?? selected;
  return {
    active:
      SITE_DESIGN_SECTIONS.find((section) => section.id === id) ??
      SITE_DESIGN_SECTIONS[0],
    select: (next: string) => {
      void setSection(next);
    },
  };
}
