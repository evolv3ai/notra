"use client";

import { useEffect, useState } from "react";

export const useOpencodeFrame = (
  frameCount: number,
  intervalMs: number,
  active: boolean
): number => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active || frameCount < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % frameCount);
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
      setFrame(0);
    };
  }, [active, frameCount, intervalMs]);

  return active ? frame : 0;
};
