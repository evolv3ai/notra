import type { PostStatus } from "@notra/schemas/dashboard/content";

export interface ContentCardProps {
  id: string;
  title: string;
  preview: string;
  contentType: string;
  contentSubtype?: string | null;
  status: PostStatus;
  organizationId: string;
  className?: string;
  href?: string;
  imagePreviewSrc?: string | null;
}
