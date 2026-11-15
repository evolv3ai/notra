import type { ReactNode } from "react";

export interface MarketingHeroWashProps {
  children?: ReactNode;
  className?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  media?: ReactNode;
  /** Drawn over the dither and behind the copy; the hero leaves room at the bottom for it. */
  backdrop?: ReactNode;
}
