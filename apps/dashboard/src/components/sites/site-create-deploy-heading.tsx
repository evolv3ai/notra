"use client";

import { HugeiconsIcon } from "@hugeicons/react";

import { SITE_CREATE_DEPLOY_TONE_ICONS } from "@/constants/site-create";
import { cn } from "@/lib/utils";
import type { SiteCreateDeployHeadingProps } from "@/types/components/sites";

export function SiteCreateDeployHeading({
  headline,
  tone,
}: SiteCreateDeployHeadingProps) {
  const announced = tone !== "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        tone === "success" && "text-success",
        tone === "error" && "text-destructive",
        tone === "pending" && "text-muted-foreground"
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          tone === "pending" && "motion-safe:animate-spin"
        )}
        icon={SITE_CREATE_DEPLOY_TONE_ICONS[tone]}
        strokeWidth={1.75}
      />
      <span
        aria-hidden={announced || undefined}
        className={cn(tone === "error" && "text-foreground")}
      >
        {headline}
      </span>
      <span aria-live="polite" className="sr-only">
        {announced ? headline : ""}
      </span>
    </span>
  );
}
