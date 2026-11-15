import type { AnchorHTMLAttributes, ComponentType } from "react";

export interface DashboardLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  /** Only mark the link current on its exact path, not on nested paths. */
  exact?: boolean;
}

export interface LazyComponentOptions {
  ssr?: boolean;
  loading?: ComponentType;
}
