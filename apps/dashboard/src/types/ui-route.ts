import type { AnyRoute, RouteComponent } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";

import type { SiteSection } from "@/types/sites";
import type { lazyPage } from "@/utils/lazy-page";

export type UiRouteSearch = Record<string, string | string[] | undefined>;

export interface UiRouteInput {
  params: Record<string, string>;
  searchParams: UiRouteSearch;
  /** The route's gate already ran for this request (streamed first render). */
  gated?: boolean;
}

export interface UiPageParams extends Record<string, string> {
  slug: string;
  id: string;
  name: string;
  chatId: string;
  handle: string;
  competitor: string;
  integrationSlug: string;
  siteId: string;
  deploymentId: string;
}

export interface UiPageProps<T> {
  params: UiPageParams;
  searchParams: UiRouteSearch;
  data: T;
}

export interface UiRouteMatch {
  routeId: string;
  loaderData?: unknown;
}

export interface UiRouteTitle {
  namespace?: string;
  key?: string;
  title?: string;
  descriptionKey?: string;
}

interface UiRouteOptions<T> {
  path: string;
  component: ComponentType<UiPageProps<NoInfer<T>>>;
  loader?: (input: UiRouteInput) => Promise<T>;
  pendingComponent?: RouteComponent;
  title?: UiRouteTitle;
  pageTitle?: (data: T) => string;
  /** Appended to the title, e.g. the name of the site a page belongs to. */
  titleSuffix?: (matches: readonly UiRouteMatch[]) => string | null | undefined;
  /** Keeps the page out of search indexes, for unlisted public pages. */
  noindex?: boolean;
  /**
   * Stream the page data into the first server-rendered document: the shell
   * and `pendingComponent` flush before `loader` resolves. Gated client
   * navigations also defer data, with a page-local loading boundary. Use
   * `"ssr"` to keep client navigations in the router's loading boundary.
   */
  stream?: boolean | "ssr";
  /**
   * Awaited before a streamed loader starts, for redirects that must reach
   * the browser as HTTP redirects. Also runs before deferring client data,
   * so the router handles redirects before committing the destination.
   */
  gate?: (input: UiRouteInput) => Promise<unknown>;
  /**
   * Downloads the page's code (a `lazyPage` component's `preload`). The router
   * calls it when the route is preloaded on hover or loaded, so the chunk
   * arrives with the data instead of after it.
   */
  preload?: () => Promise<unknown>;
  /**
   * The search params the loader depends on. Other params (settings modal,
   * in-page tabs, filters) then change the URL without re-running the loader,
   * which is a server round trip and can flash `pendingComponent`. The loader
   * still receives the full search. Omit to re-run on any search change.
   */
  loaderSearchKeys?: readonly string[];
}

export interface StreamedUiPageProps<T> extends Omit<UiPageProps<T>, "data"> {
  page: ComponentType<UiPageProps<T>>;
  pending: Promise<T>;
}

export interface UiRouteFactoryOptions<T> extends UiRouteOptions<T> {
  parent: AnyRoute;
}

export interface UiModalProviderProps {
  children: ReactNode;
}

export interface SiteSectionUiPage {
  section: Exclude<SiteSection, "overview">;
  page: ReturnType<typeof lazyPage>;
  /** Pending view while the page chunk loads; defaults to the generic section skeleton. */
  skeleton?: RouteComponent;
}
