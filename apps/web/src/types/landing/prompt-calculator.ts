import type { ComponentType, SVGProps } from "react";

import type {
  PROMPT_CALCULATOR_ENGINE_IDS,
  PROMPT_CALCULATOR_FREQUENCIES,
} from "@/constants/landing/prompt-calculator";
import type { PricingPlan } from "@/types/landing/pricing";

type PromptCalculatorEngineId = (typeof PROMPT_CALCULATOR_ENGINE_IDS)[number];

export type PromptCalculatorFrequencyId =
  (typeof PROMPT_CALCULATOR_FREQUENCIES)[number]["id"];

export interface PromptCalculatorInput {
  prompts: number;
  models: string[];
  frequency: PromptCalculatorFrequencyId;
}

export interface PromptCalculatorEstimate {
  answersPerMonth: number;
  scansPerMonth: number;
  plan: PricingPlan;
  usage: number | null;
  promptHeadroom: number | null;
}

export interface PromptCalculatorPanelProps {
  value: PromptCalculatorInput;
  onChange: (value: Partial<PromptCalculatorInput>) => void;
}

export interface PromptCalculatorEngine {
  id: PromptCalculatorEngineId;
  name: string;
  featured: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  darkIcon?: ComponentType<SVGProps<SVGSVGElement>>;
  models: readonly PromptCalculatorModel[];
  defaultModel: string;
}

interface PromptCalculatorModel {
  id: string;
  label: string;
}
