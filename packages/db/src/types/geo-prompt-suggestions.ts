/** A pause suggestion for a prompt that never named any brand. */
export interface GeoPromptSuggestionReasonData {
  kind: "no_brands";
  answers: number;
  lookbackDays: number;
}
