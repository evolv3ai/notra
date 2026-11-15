import type { BlogPostSidebarProps } from "~types/blog";

import { BlogPostAuthorCard } from "@/components/blog-post-author-card";
import { BlogPostToc } from "@/components/blog-post-toc";
import { formatBlogDate } from "@/utils/format-date";

export function BlogPostSidebar({
  authors,
  toc,
  updatedAt,
}: BlogPostSidebarProps) {
  return (
    <aside className="col-start-1 row-start-2 min-w-0 lg:col-start-2 lg:row-span-3 lg:row-start-1">
      <BlogPostAuthorCard authors={authors} />
      <p className="mt-4 font-sans text-xs text-neutral-500 lg:mt-6 dark:text-neutral-400">
        Last edited{" "}
        <time
          className="text-neutral-700 dark:text-neutral-200"
          dateTime={updatedAt}
        >
          {formatBlogDate(updatedAt)}
        </time>
      </p>
      <div className="sticky top-8 mt-8 hidden lg:block">
        <BlogPostToc toc={toc} />
      </div>
    </aside>
  );
}
