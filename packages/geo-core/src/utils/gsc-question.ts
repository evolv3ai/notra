import { GSC_QUESTION_QUERY_PATTERN } from "../constants/google-search-console";

const QUESTION_QUERY = new RegExp(GSC_QUESTION_QUERY_PATTERN, "u");

/** Same test Search Console runs for the question pull. */
export function isQuestionQuery(query: string): boolean {
  return QUESTION_QUERY.test(query.trim().toLowerCase());
}
