import type {
  ContentListPreviewInput,
  ContentListPreviewVariant,
} from "@/types/content/preview";
import {
  getDashboardPostPreview,
  getMarkdownPreview,
} from "@/utils/content-preview";

export function getContentListPreview(
  post: ContentListPreviewInput,
  variant: ContentListPreviewVariant = "collection"
) {
  const preview =
    variant === "dashboard"
      ? getDashboardPostPreview(post.markdown ?? "")
      : getMarkdownPreview(post.markdown ?? "");

  return {
    preview,
    content: post.contentType === "image" ? post.content : "",
    markdown: post.contentType === "image" ? post.markdown : null,
  };
}
