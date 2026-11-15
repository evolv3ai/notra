import type { IconSvgElement } from "@hugeicons/react";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";

export interface BlogAuthorAvatarProps {
  image: string | null;
  name: string;
  size?: number;
}

export interface NotraAuthorSocial {
  url: string;
  platform: string;
}

export interface NotraBlogAuthor {
  id: string;
  name: string;
  image: string | null;
  slug: string;
  bio: string | null;
  role: string | null;
  socials: NotraAuthorSocial[];
}

export interface NotraAuthor extends NotraBlogAuthor {
  postCount: number;
}

export interface BlogCopyArticleProps {
  markdown: string;
  markdownUrl: string;
  title: string;
}

export interface BlogCopyArticleItemProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface NotraBlogPost {
  id: string;
  title: string;
  content: string;
  markdown: string;
  recommendations: string | null;
  contentType: string;
  sourceMetadata: null;
  status: string;
  createdAt: string;
  updatedAt: string;
  slug: string;
  excerpt: string;
  image: string | null;
  authors: NotraBlogAuthor[];
  hidden: boolean;
}

interface BlogPageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description: ReactNode;
}

interface BlogTimelineItem {
  id: string;
  title: string;
  description: string;
  href: string;
  date: string;
}

export interface BlogCardAuthor {
  name: string;
  image: string | null;
  slug: string;
  href: string;
}

export interface BlogPaginationLink {
  slug: string;
  href: string;
  title: string;
  author: BlogCardAuthor | null;
}

export interface BlogPostPaginationProps {
  previous: BlogPaginationLink | null;
  next: BlogPaginationLink | null;
}

export interface BlogPaginationCardProps {
  link: BlogPaginationLink;
  direction: "previous" | "next";
  align: "left" | "right";
}

export interface BlogCardItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  href: string;
  date: string;
  author: BlogCardAuthor | null;
}

export interface BlogPostCardProps {
  item: BlogCardItem;
}

interface BlogTimelineProps {
  items: BlogTimelineItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}

interface BlogHtmlArticleProps {
  html: string;
}

export type BlogEntryData = Awaited<
  ReturnType<typeof import("@/lib/blog/functions").getBlogPost>
>;

export interface BlogFaqEntry {
  question: string;
  answer: string;
}

export interface BlogJsonLdInput {
  post: NotraBlogPost;
  url: string;
  imageUrl: string;
}

export interface BlogArticleProps {
  children: ReactNode;
}

export interface BlogPostAuthorCardProps {
  authors: NotraBlogAuthor[];
}

export interface BlogPostTocProps {
  toc: TOCItemType[];
}

interface TocEntry {
  id: string;
  url: string;
  title: ReactNode;
}

export interface TocSection extends TocEntry {
  children: TocEntry[];
}

export interface BlogPostSidebarProps {
  authors: NotraBlogAuthor[];
  toc: TOCItemType[];
  updatedAt: string;
}

export interface ResolvedSocialLink {
  label: string;
  displayUrl: string;
  url: string;
  icon: IconSvgElement;
}
