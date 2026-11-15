export type SuggestionType = "schedule_automation" | "event_automation";

export interface OnboardingSuggestionsProps {
  organizationId: string;
  onCreate: (suggestionId: string, type: SuggestionType) => void;
}

/** The parts of a stored suggestion the automation editor reads. */
export interface OnboardingSuggestionDraft {
  title: string;
  description: string | null;
  data: unknown;
}
