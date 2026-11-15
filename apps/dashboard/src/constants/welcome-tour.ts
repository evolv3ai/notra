export const WELCOME_TOUR_SEARCH_PARAM = "welcome";
export const WELCOME_TOUR_STEPS = ["ask", "rank", "gaps"] as const;
export const WELCOME_TOUR_ENGINES = [
  "chatgpt",
  "claude",
  "gemini",
  "perplexity",
] as const;
export const WELCOME_TOUR_RANKING = [
  { key: "you", share: 72 },
  { key: "competitorA", share: 48 },
  { key: "competitorB", share: 21 },
] as const;
export const WELCOME_TOUR_SKELETON_LINES = [
  "w-full",
  "w-11/12",
  "w-3/5",
] as const;
