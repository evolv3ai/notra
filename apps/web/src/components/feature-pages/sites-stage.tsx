import { GitBranchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Badge } from "@notra/ui/components/ui/badge";
import { Github } from "@notra/ui/components/ui/svgs/github";

import { StageShell } from "@/components/feature-pages/stage-shell";
import {
  SITES_STAGE_BADGES,
  SITES_STAGE_IMAGE,
  SITES_STAGE_OUTPUTS,
  SITES_STAGE_POSTS,
  SITES_STAGE_PUSH,
} from "@/constants/feature-pages/sites";

// The cards stay white in dark mode, so the badges keep their light tokens.
const LIGHT_BADGE_TOKENS =
  "dark:[--background:white] dark:[--badge-secondary:hsl(0_0%_96.1%)] dark:[--badge-success:oklch(0.46_0.109_155)] dark:[--secondary-foreground:hsl(0_0%_9%)] dark:[--success:oklch(0.55_0.109_155)]";

const CONNECTORS = [
  "M536 0 C536 40 160 32 160 76",
  "M536 0 L536 76",
  "M536 0 C536 40 912 32 912 76",
];

export function SitesStage() {
  return (
    <StageShell
      className={`flex flex-col items-center bg-center lg:px-16 lg:pt-12 lg:pb-12 ${LIGHT_BADGE_TOKENS}`}
      image={SITES_STAGE_IMAGE}
    >
      <div className="flex max-w-full items-center gap-3 rounded-full border border-white/90 bg-white/92 py-3 pr-3 pl-4">
        <Github className="size-5 shrink-0 text-[#1E1E1E]" />
        <span className="min-w-0 truncate font-mono text-[0.8125rem]/5 text-[#1E1E1E] sm:text-[0.9375rem]/5.5">
          {SITES_STAGE_PUSH.file}
        </span>
        <Badge shape="rounded" size="md" variant="secondary">
          <HugeiconsIcon
            aria-hidden="true"
            icon={GitBranchIcon}
            strokeWidth={1.5}
          />
          {SITES_STAGE_PUSH.branch}
        </Badge>
      </div>

      <svg
        aria-hidden="true"
        className="hidden h-19 w-full max-w-268 shrink-0 md:block"
        preserveAspectRatio="none"
        viewBox="0 0 1072 76"
        xmlns="http://www.w3.org/2000/svg"
      >
        {CONNECTORS.map((d) => (
          <path
            d={d}
            fill="none"
            key={d}
            stroke="#1E1E1E59"
            strokeDasharray="3 5"
            strokeLinecap="round"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <ul className="mt-6 grid w-full grid-cols-1 gap-4 md:mt-0 md:grid-cols-3 md:gap-8 lg:gap-14">
        {SITES_STAGE_POSTS.map((post) => (
          <li
            className="flex flex-col overflow-clip rounded-2xl border border-white/90 bg-white"
            key={post.path}
          >
            <div className="flex grow flex-col gap-2 px-4.5 pt-4.5 pb-4">
              <span className="font-sans text-base/5.5 font-semibold text-balance text-[#1E1E1E]">
                {post.title}
              </span>
              <p className="font-sans text-sm/5.25 text-[#6B6B6B]">
                {post.excerpt}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-2">
                <img
                  alt=""
                  className="size-5 shrink-0 rounded-full"
                  height={20}
                  src={post.avatar}
                  width={20}
                />
                <span className="font-sans text-[0.8125rem]/4 text-[#6B6B6B]">
                  {post.author} · {post.date}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#EFEFEF] bg-[#FAFAFA] px-4.5 py-3">
              <span className="min-w-0 truncate font-mono text-xs/4 text-[#8A8A8A]">
                {post.path}
              </span>
              {post.fresh ? (
                <StatusBadge
                  appearance={SITES_STAGE_BADGES.publishedAppearance}
                  label={SITES_STAGE_BADGES.published}
                />
              ) : (
                <Badge shape="rounded" variant="success">
                  {SITES_STAGE_BADGES.live}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex max-w-full flex-wrap items-center justify-center gap-0 rounded-3xl border border-white/90 bg-white/92 p-1 sm:gap-1 sm:rounded-full">
        <span className="w-full px-3 pt-1 text-center font-sans text-[0.8125rem] text-[#4A4A4A] sm:w-auto sm:pt-0 sm:text-sm">
          {SITES_STAGE_OUTPUTS.label}
        </span>
        <span
          aria-hidden="true"
          className="hidden h-4 w-px bg-[#E4E4E4] sm:block"
        />
        {SITES_STAGE_OUTPUTS.items.map((item) => (
          <span
            className="rounded-full px-1.5 py-1 font-mono text-xs/4 text-[#1E1E1E] sm:px-2.5"
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </StageShell>
  );
}
