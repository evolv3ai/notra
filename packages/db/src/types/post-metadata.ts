/** Cover image of a blog post or changelog entry, stored in Notra's media bucket. */
export interface PostCoverImage {
  url: string;
  alt: string;
}

/** A metadata patch as validated by `postMetadataPatchSchema`. */
export interface PostMetadataColumnsPatch {
  coverImage?: PostCoverImage | null;
  tags?: string[];
  excerpt?: string | null;
  authorIds?: string[];
  featured?: boolean;
  noindex?: boolean;
  hidden?: boolean;
  /** YYYY-MM-DD */
  displayDate?: string | null;
}
