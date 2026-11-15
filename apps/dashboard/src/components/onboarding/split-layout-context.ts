import { createContext } from "react";

import type { OnboardingLayoutContext } from "@/types/onboarding-layout";

export const OnboardingSplitLayoutContext =
  createContext<OnboardingLayoutContext | null>(null);

export const OnboardingPreviewTargetContext = createContext<HTMLElement | null>(
  null
);
