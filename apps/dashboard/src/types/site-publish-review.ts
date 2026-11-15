import type { useSitePublishReview } from "@/lib/hooks/use-site-publish-review";
import type { SitePublishDialogProps } from "@/types/components/sites";

export interface SitePublishReviewProps {
  review: ReturnType<typeof useSitePublishReview>;
  props: SitePublishDialogProps;
}
