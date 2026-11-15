import type { WELCOME_TOUR_STEPS } from "@/constants/welcome-tour";

type WelcomeTourStep = (typeof WELCOME_TOUR_STEPS)[number];

export interface WelcomeTourProps {
  brandName?: string;
  onClose: () => void;
}

export interface WelcomeTourSceneProps {
  brandName?: string;
  step: WelcomeTourStep;
}
