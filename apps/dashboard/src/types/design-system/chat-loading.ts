import type { UIMessage } from "ai";

export interface ChatLoadingFrame {
  delayMs: number;
  isLoading: boolean;
  messages: UIMessage[];
}

export interface ChatLoadingScenario {
  id: string;
  label: string;
  frames: ChatLoadingFrame[];
}
