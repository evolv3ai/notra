"use client";

import { createContext, useContext } from "react";

import type { DemoPlaygroundTab } from "@/types/demo";

interface DemoPlaygroundContextValue {
  openPlayground: (tab?: DemoPlaygroundTab) => void;
}

export const DemoPlaygroundContext =
  createContext<DemoPlaygroundContextValue | null>(null);

export function useDemoPlayground() {
  return useContext(DemoPlaygroundContext);
}
