"use client";

import { useState } from "react";

import { SKELETON_EXIT_CLASS } from "@/constants/skeleton";
import { cn } from "@/lib/utils";
import type { SkeletonCrossfadeProps } from "@/types/skeleton";

export function SkeletonCrossfade({
  loading,
  skeleton,
  children,
  fadeOnMount = false,
}: SkeletonCrossfadeProps) {
  const [previousLoading, setPreviousLoading] = useState(loading);
  const [exiting, setExiting] = useState(fadeOnMount && !loading);
  if (loading !== previousLoading) {
    setPreviousLoading(loading);
    setExiting(!loading);
  }

  return (
    <div
      className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col"
      data-skeleton-transition={loading ? "loading" : "content"}
    >
      {loading ? skeleton : children}
      {!loading && exiting ? (
        <div
          aria-hidden="true"
          className={cn(
            "bg-background pointer-events-none absolute inset-0 z-50",
            SKELETON_EXIT_CLASS
          )}
          inert
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) {
              setExiting(false);
            }
          }}
        >
          {skeleton}
        </div>
      ) : null}
    </div>
  );
}
