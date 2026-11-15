import type { NavbarVariant } from "@/types/navbar";

const BLOG_POST_PATH_PATTERN = /^\/blog\/(?!author(?:\/|$))[^/]+$/;
const ANNOUNCEMENT_PATHS = new Set(["/", "/home", "/landing"]);

export function getNavbarVariantForPath(pathname: string): NavbarVariant {
  if (BLOG_POST_PATH_PATTERN.test(pathname)) {
    return "static";
  }
  if (ANNOUNCEMENT_PATHS.has(pathname)) {
    return "announcement";
  }
  return "landing";
}
