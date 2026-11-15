import type {
  SiteValidationQuery,
  SiteValidationReviewQuery,
} from "@/types/sites";

export function siteValidationReady(query: SiteValidationQuery): boolean {
  return query.isSuccess && !query.isPlaceholderData && query.data?.ok === true;
}

/** Opening the review is safe while checks run; publishing still requires success. */
export function siteValidationBlocksReview(
  query: SiteValidationReviewQuery
): boolean {
  return query.isError || query.data?.ok === false;
}
