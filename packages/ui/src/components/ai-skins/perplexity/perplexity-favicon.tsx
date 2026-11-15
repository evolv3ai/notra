"use client";

import { cn } from "@notra/ui/lib/utils";
import { googleFaviconUrl } from "@notra/utils/google-favicon";
import { Image } from "@notra/ui/components/framework-provider";
import { useState } from "react";


export function PerplexityFavicon({
  domain,
  className,
}: {
  domain: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = googleFaviconUrl(domain, 64);

  if (failed || !src) {
    return (
      <span
        aria-hidden
        className={cn("inline-block rounded-full bg-[#e8e8e8] dark:bg-white/12", className)}
      />
    );
  }

  return (
    <Image
      alt=""
      className={cn("rounded-full bg-[#e8e8e8] dark:bg-white/12", className)}
      height={64}
      onError={() => setFailed(true)}
      src={src}
      unoptimized
      width={64}
    />
  );
}
