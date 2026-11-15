"use client";

import { cn } from "@notra/ui/lib/utils";
import Image from "next/image";
import { useState } from "react";

import type { BrandLogoProps } from "@/types/geo-report";
import { getBrandInitials, getBrandLogoCandidates } from "@/utils/brand-logo";

const DEFAULT_LOGO_SIZE = 40;

/** Company logo via context.dev Logo Link, falling back to a favicon, then initials. */
function BrandLogoImage({
  domain,
  name,
  className,
  size = DEFAULT_LOGO_SIZE,
}: BrandLogoProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = getBrandLogoCandidates(domain);
  const src = candidates[candidateIndex];

  if (!src) {
    return (
      <span
        aria-label={`${name} logo`}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-(--geo-paper-deep) text-xs font-medium text-(--geo-muted)",
          className
        )}
        role="img"
        style={{ width: size, height: size }}
      >
        {getBrandInitials(name)}
      </span>
    );
  }

  return (
    <Image
      alt={`${name} logo`}
      className={cn("shrink-0 rounded-md object-contain", className)}
      height={size}
      onError={() => setCandidateIndex((index) => index + 1)}
      src={src}
      unoptimized
      width={size}
    />
  );
}

export function BrandLogo(props: BrandLogoProps) {
  return <BrandLogoImage key={props.domain} {...props} />;
}
