import type { ComponentType, ReactNode, SVGProps } from "react";

import type { EngineId } from "@/types/landing/geo";

export interface HeroCycleWord {
  text: string;
  engine: EngineId;
}

export interface HeroHeadlineBrand {
  before: string;
  name: string;
  after: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName?: string;
}

export interface HeroHeadlineProps {
  word: HeroCycleWord;
  lineOne: string | HeroHeadlineBrand;
  lineTwo: HeroHeadlineLineTwo;
}

export interface CycleMarkProps {
  markKey: string;
  animated: boolean;
  className?: string;
  children: ReactNode;
}

type HeroHeadlineLineTwo =
  | { headlineLineTwoPrefix: string }
  | { headlineLineTwo: string };

export type HeroVariantCopy = HeroHeadlineLineTwo & {
  headlineLineOne: string | HeroHeadlineBrand;
  subhead: string;
  cta: string;
  secondaryLabel: string;
  secondaryHref: string;
};
