import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";

import {
  ANNOUNCEMENT_HREF,
  ANNOUNCEMENT_TEXT,
  ANNOUNCEMENT_TEXT_MOBILE,
} from "@/constants/landing/announcement";

export function AnnouncementBanner() {
  return (
    <Link
      className="group bg-primary-hover text-primary-foreground hover:bg-primary-hover/90 flex h-10 w-full items-center justify-center gap-1.5 px-4 font-sans text-[0.8125rem] leading-none font-medium tracking-[-0.01em] transition-colors sm:text-sm"
      to={ANNOUNCEMENT_HREF}
    >
      <span className="truncate sm:hidden">{ANNOUNCEMENT_TEXT_MOBILE}</span>
      <span className="hidden truncate sm:inline">{ANNOUNCEMENT_TEXT}</span>
      <HugeiconsIcon
        aria-hidden
        className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
        icon={ArrowRight02Icon}
      />
    </Link>
  );
}
