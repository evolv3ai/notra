export interface OnboardingStatus {
  hasPrompt: boolean;
  hasCompetitor: boolean;
  hasScan: boolean;
  hasAgentReadiness: boolean;
  onboardingCompleted: boolean;
  onboardingDismissed: boolean;
}

export interface UseOnboardingStatusOptions {
  refetchInterval?: number | false;
}

export interface UseOnboardingSuggestionsOptions {
  agentRunning?: boolean;
}

export interface OnboardingRunSnapshot {
  organizationId: string;
  running: boolean;
}

export interface OnboardingAgentStateSource {
  ran: boolean;
  startedAt: Date | null;
}

export interface OnboardingAgentRunState extends OnboardingAgentStateSource {
  running: boolean;
}

export interface InitialOnboardingAgentRun {
  organizationId: string;
  state: OnboardingAgentRunState;
}
