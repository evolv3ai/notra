import { Github } from "@notra/ui/components/ui/svgs/github";
import { cn } from "@notra/ui/lib/utils";

import {
  NavbarBentoFeatureTile,
  NavbarBentoLinkTile,
  NavbarBentoMockHeader,
  NavbarBentoWindow,
} from "@/components/navbar-bento";
import { BLOG_AUTHORS } from "@/constants/blog-authors";
import { NAVBAR_BENTO_CLASSES as CLASSES } from "@/constants/navbar-bento";
import {
  NAVBAR_RESOURCES_DOCS_PAGES,
  NAVBAR_RESOURCES_FALLBACK_LINK_STYLE,
  NAVBAR_RESOURCES_FEATURE_STYLES,
  NAVBAR_RESOURCES_LINK_STYLES,
  NAVBAR_RESOURCES_POSTS,
  NAVBAR_RESOURCES_PULL_REQUESTS,
  NAVBAR_RESOURCES_RELEASE_TYPES,
  NAVBAR_RESOURCES_RELEASES,
  NAVBAR_RESOURCES_REVIEW_LINES,
} from "@/constants/navbar-resources";
import type {
  NavbarBentoMockProps,
  NavbarBentoPanelProps,
  NavbarResourcesMock,
} from "@/types/navbar-bento";

function BlogMock() {
  return (
    <span className="flex gap-3">
      {NAVBAR_RESOURCES_POSTS.map((post) => {
        const author = BLOG_AUTHORS.find(
          (blogAuthor) => blogAuthor.slug === post.authorSlug
        );
        return (
          <span className={cn(CLASSES.mockCard, "w-75")} key={post.title}>
            <span className="flex flex-col gap-2 px-4.5 pt-4.5 pb-4">
              <span className="font-mono text-xs/4 text-[#8A8A8A]">
                {post.date}
              </span>
              <span className={CLASSES.mockTitle}>{post.title}</span>
              <span className="font-sans text-sm/5.25 text-[#6B6B6B] dark:text-neutral-400">
                {post.description}
              </span>
            </span>
            {author ? (
              <span className="flex items-center gap-2.5 border-t border-[#EFEFEF] bg-[#FAFAFA] px-4.5 py-3 dark:border-white/10 dark:bg-white/5">
                <img
                  alt=""
                  className="size-6 shrink-0 rounded-full"
                  height={24}
                  src={author.image ?? undefined}
                  width={24}
                />
                <span className="font-sans text-[0.8125rem]/4 font-medium text-[#1E1E1E] dark:text-white">
                  {author.name}
                </span>
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function ChangelogMock() {
  return (
    <span className={cn(CLASSES.mockCard, "w-130")}>
      <NavbarBentoMockHeader meta="Shipped this week" title="Notra changelog">
        <span className="size-1.75 shrink-0 rounded-full bg-[#22A55A] shadow-[0_0_0_0.1875rem_#22A55A2E]" />
        <span className={CLASSES.mockPillLabel}>Live</span>
      </NavbarBentoMockHeader>
      <span className="flex flex-col pt-1.5 pb-2">
        {NAVBAR_RESOURCES_RELEASES.map((release, index) => (
          <span
            className={cn(
              "flex items-center gap-3.5 px-5 py-2.75",
              index === 0 && "bg-[#F6F2FE] dark:bg-white/5"
            )}
            key={release.title}
          >
            <span className="w-13 shrink-0 font-mono text-xs/4 text-[#8A8A8A]">
              {release.date}
            </span>
            <span
              className={cn(
                "w-11 shrink-0 rounded-md border py-0.5 text-center font-mono text-xs/4 font-medium",
                NAVBAR_RESOURCES_RELEASE_TYPES[release.type]
              )}
            >
              {release.type}
            </span>
            <span className="font-sans text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white">
              {release.title}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

function ContributorsMock() {
  return (
    <span className={cn(CLASSES.mockCard, "w-130")}>
      <NavbarBentoMockHeader
        meta="usenotra/notra · last 7 days"
        title="Merged pull requests"
      >
        <Github aria-hidden="true" className="size-3.5 shrink-0" />
        <span className={CLASSES.mockPillLabel}>GitHub</span>
      </NavbarBentoMockHeader>
      <span className="flex flex-col pt-1.5 pb-2">
        {NAVBAR_RESOURCES_PULL_REQUESTS.map((pullRequest) => (
          <span
            className="flex items-center gap-3 px-5 py-2.75"
            key={pullRequest.number}
          >
            <img
              alt=""
              className="size-5 shrink-0 rounded-full"
              height={20}
              src={pullRequest.avatar}
              width={20}
            />
            <span className="w-26 shrink-0 font-sans text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white">
              {pullRequest.login}
            </span>
            <span className="grow basis-0 truncate font-sans text-sm/4.5 text-[#6B6B6B] dark:text-neutral-400">
              {pullRequest.title}
            </span>
            <span className="shrink-0 font-mono text-xs/4 text-[#8A8A8A]">
              #{pullRequest.number}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

function DocsMock() {
  return (
    <NavbarBentoWindow className="top-3 left-0 w-72" label="docs">
      <span className="flex flex-col gap-0.5 p-2">
        {NAVBAR_RESOURCES_DOCS_PAGES.map((page, index) => (
          <span
            className={cn(
              "rounded-md px-2.5 py-1.5 font-sans text-[0.8125rem]/4 text-[#6B6B6B] dark:text-neutral-400",
              index === 0 &&
                "bg-[#F1EBFE] font-medium text-[#6D3FD9] dark:bg-white/10 dark:text-white"
            )}
            key={page}
          >
            {page}
          </span>
        ))}
      </span>
    </NavbarBentoWindow>
  );
}

function ReviewsMock() {
  return (
    <NavbarBentoWindow className="top-3 left-0 w-72" label="notrareviews.com">
      <span className="flex items-start gap-3 p-3.5">
        <span className="size-8 shrink-0 rounded-full bg-[#F1EBFE] dark:bg-white/10" />
        <span className="flex flex-col gap-2 pt-1">
          {NAVBAR_RESOURCES_REVIEW_LINES.map((width) => (
            <span
              className={cn(
                "h-2 rounded-full bg-[#1E1E1E14] dark:bg-white/10",
                width
              )}
              key={width}
            />
          ))}
        </span>
      </span>
    </NavbarBentoWindow>
  );
}

function ResourcesMock({ mock }: NavbarBentoMockProps<NavbarResourcesMock>) {
  if (mock === "blog") {
    return <BlogMock />;
  }
  if (mock === "changelog") {
    return <ChangelogMock />;
  }
  if (mock === "contributors") {
    return <ContributorsMock />;
  }
  if (mock === "docs") {
    return <DocsMock />;
  }
  return <ReviewsMock />;
}

export function NavbarResourcesPanel({
  group,
  onSelect,
}: NavbarBentoPanelProps) {
  return (
    <div className={CLASSES.panel}>
      <div className={CLASSES.row}>
        {group.cards.map((card) => {
          const style = NAVBAR_RESOURCES_FEATURE_STYLES[card.href];
          return (
            <NavbarBentoFeatureTile
              card={card}
              className="h-68"
              iconClassName={style?.iconClassName}
              key={card.href}
              onSelect={onSelect}
            >
              {style ? <ResourcesMock mock={style.mock} /> : null}
            </NavbarBentoFeatureTile>
          );
        })}
      </div>
      <div className={CLASSES.row}>
        {group.rail.map((item) => {
          const style = NAVBAR_RESOURCES_LINK_STYLES[item.href];
          return (
            <NavbarBentoLinkTile
              key={item.href}
              link={item}
              onSelect={onSelect}
              style={style ?? NAVBAR_RESOURCES_FALLBACK_LINK_STYLE}
            >
              {style ? <ResourcesMock mock={style.mock} /> : null}
            </NavbarBentoLinkTile>
          );
        })}
      </div>
    </div>
  );
}
