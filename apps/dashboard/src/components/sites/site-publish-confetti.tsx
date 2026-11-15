"use client";

import { useEffect, useState } from "react";

import { Confetti } from "@/components/confetti";
import { CONFETTI_COLORS } from "@/constants/post-social";
import { SITE_PUBLISHED_EVENT } from "@/constants/sites";

/** Celebrates a publish from anywhere in the site, even across branch switches. */
export function SitePublishConfetti() {
  const [celebration, setCelebration] = useState(0);
  useEffect(() => {
    const celebrate = () => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setCelebration((count) => count + 1);
      }
    };
    window.addEventListener(SITE_PUBLISHED_EVENT, celebrate);
    return () => window.removeEventListener(SITE_PUBLISHED_EVENT, celebrate);
  }, []);
  if (celebration === 0) {
    return null;
  }
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-1/2 z-[100] -translate-x-1/2"
    >
      <Confetti
        colors={CONFETTI_COLORS}
        duration={3000}
        force={0.5}
        key={celebration}
        particleCount={120}
        particleShape="mix"
        particleSize={8}
        stageHeight={600}
        stageWidth={800}
      />
    </div>
  );
}
