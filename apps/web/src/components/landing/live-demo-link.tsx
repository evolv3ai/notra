import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { LiveDemoPreview } from "@/components/landing/live-demo-preview";
import {
  LIVE_DEMO_OPEN_LABEL,
  LIVE_DEMO_URL,
} from "@/constants/landing/live-demo";

export function LiveDemoLink() {
  return (
    <div className="aspect-[9/10] w-full max-w-[64rem] sm:aspect-auto sm:h-[36rem] lg:h-auto lg:flex-1">
      <a
        className="group border-border bg-background relative block size-full overflow-hidden rounded-xl border sm:rounded-2xl lg:rounded-b-none lg:border-b-0"
        aria-label={LIVE_DEMO_OPEN_LABEL}
        href={LIVE_DEMO_URL}
        rel="nofollow"
      >
        <LiveDemoPreview />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-focus-visible:bg-black/30 pointer-coarse:items-end pointer-coarse:pb-4 pointer-fine:group-hover:bg-black/30">
          <span className="bg-foreground text-background flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100">
            {LIVE_DEMO_OPEN_LABEL}
            <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
          </span>
        </span>
      </a>
    </div>
  );
}
