import { Github } from "@notra/ui/components/ui/svgs/github";

import { SITES_HEADLINE } from "@/constants/feature-pages/sites";

export function SitesHeadline() {
  return (
    <>
      <span className="block">
        {SITES_HEADLINE.before}
        <span className="relative mx-[0.22em] inline-flex size-[1cap] align-baseline">
          <Github className="size-full" />
        </span>
        {SITES_HEADLINE.mark}
      </span>
      <span className="block">{SITES_HEADLINE.after}</span>
    </>
  );
}
