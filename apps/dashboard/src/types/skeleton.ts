import type { ReactNode } from "react";

export interface SkeletonCrossfadeProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  /** A route fallback may have rendered before this component mounted. */
  fadeOnMount?: boolean;
}
