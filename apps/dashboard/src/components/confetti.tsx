"use client";

import dynamic from "@/utils/lazy-component";

export const Confetti = dynamic(
  () => import("@neoconfetti/react").then((module) => module.Confetti),
  { ssr: false }
);
