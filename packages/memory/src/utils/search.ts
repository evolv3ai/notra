import {
  MEMORY_SEARCH_MAX_KEYWORDS,
  MEMORY_SEARCH_MIN_KEYWORD_LENGTH,
  MEMORY_SEARCH_STOPWORDS,
  MEMORY_SEARCH_WORD,
} from "../constants/search";

export function memorySearchKeywords(query: string) {
  const keywords = new Set<string>();
  for (const word of query.toLowerCase().match(MEMORY_SEARCH_WORD) ?? []) {
    if (keywords.size >= MEMORY_SEARCH_MAX_KEYWORDS) {
      break;
    }
    if (
      word.length >= MEMORY_SEARCH_MIN_KEYWORD_LENGTH &&
      !MEMORY_SEARCH_STOPWORDS.has(word)
    ) {
      keywords.add(word);
    }
  }
  return [...keywords];
}
