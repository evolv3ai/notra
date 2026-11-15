import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Badge } from "@notra/ui/components/ui/badge";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { cn } from "@notra/ui/lib/utils";

import { RankBadge } from "@/components/feature-pages/rank-badge";
import {
  NavbarBentoLinkTile,
  NavbarBentoMockHeader,
  NavbarBentoWindow,
} from "@/components/navbar-bento";
import { NavbarEngineLogo } from "@/components/navbar-engine-logo";
import { NavbarHref } from "@/components/navbar-href";
import {
  SITES_STAGE_BADGES,
  SITES_STAGE_POSTS,
  SITES_STAGE_PUSH,
} from "@/constants/feature-pages/sites";
import { NAVBAR_BENTO_CLASSES as CLASSES } from "@/constants/navbar-bento";
import {
  NAVBAR_PRODUCTS_CARDS,
  NAVBAR_PRODUCTS_CLASSES as PRODUCTS,
  NAVBAR_PRODUCTS_CRAWLER_ROWS,
  NAVBAR_PRODUCTS_LINK_TILES,
  NAVBAR_PRODUCTS_LOGO_ROWS,
  NAVBAR_PRODUCTS_LOGOS,
  NAVBAR_PRODUCTS_PERSONAS,
  NAVBAR_PRODUCTS_PURPOSES,
  NAVBAR_PRODUCTS_SITE,
  NAVBAR_PRODUCTS_TERMINAL_LINES,
  NAVBAR_PRODUCTS_TURNS,
} from "@/constants/navbar-products";
import type {
  NavbarBentoMockProps,
  NavbarBentoPanelProps,
  NavbarProductsCard,
  NavbarProductsMock,
} from "@/types/navbar-bento";

function PersonasMock() {
  return (
    <span className={cn(CLASSES.mockSlot, "gap-3")}>
      {NAVBAR_PRODUCTS_PERSONAS.map((persona) => (
        <span className={cn(CLASSES.mockCard, "w-75")} key={persona.name}>
          <span className="flex items-center gap-3 px-4.5 pt-4.5 pb-3.5">
            <img
              alt=""
              className="size-11 shrink-0 rounded-full"
              height={44}
              src={persona.avatar}
              width={44}
            />
            <span className="flex flex-col gap-0.5">
              <span className={CLASSES.mockTitle}>{persona.name}</span>
              <span className={cn(CLASSES.mockMeta, "leading-4.5")}>
                {persona.role}
              </span>
            </span>
          </span>
          <span className="flex grow flex-col gap-1.5 px-4.5 pb-4.5">
            <span className="font-mono text-[0.6875rem]/3.5 font-medium tracking-[0.08em] text-[#8A8A8A]">
              REMEMBERS
            </span>
            <span className="font-sans text-sm/5.25 text-[#1E1E1E] dark:text-neutral-200">
              {persona.memory}
            </span>
          </span>
          <span className="flex items-center justify-between border-t border-[#EFEFEF] bg-[#FAFAFA] px-4.5 py-3 dark:border-white/10 dark:bg-white/5">
            <span className="flex items-center gap-2">
              <HugeiconsIcon
                className="size-3.5 text-[#3D9A5F]"
                icon={CheckmarkCircle02Icon}
                strokeWidth={1.8}
              />
              <span className="font-sans text-[0.8125rem]/4 font-medium text-[#3D9A5F]">
                Notra mentioned
              </span>
            </span>
            <RankBadge rank={persona.rank} size="md" />
          </span>
        </span>
      ))}
    </span>
  );
}

function ConversationsMock() {
  return (
    <span className={CLASSES.mockSlot}>
      <span className={cn(CLASSES.mockCard, "w-130")}>
        <NavbarBentoMockHeader
          meta="3 turns · played Sep 27, 14:03"
          title="Changelog tool research"
        >
          <Openai
            aria-hidden="true"
            className="size-3.5 shrink-0 dark:fill-white"
          />
          <span className={CLASSES.mockPillLabel}>ChatGPT</span>
        </NavbarBentoMockHeader>
        <span className="flex flex-col gap-5.5 px-5 pt-5.5 pb-6">
          {NAVBAR_PRODUCTS_TURNS.map((turn) => (
            <span className="flex flex-col gap-3" key={turn.question}>
              <span className="flex justify-end">
                <span className="rounded-full bg-[#EEEFF4] px-4 py-2.5 font-sans text-[0.9375rem]/5 text-[#1E1E1E] dark:bg-white/10 dark:text-white">
                  {turn.question}
                </span>
              </span>
              <span className="flex items-start justify-between gap-5">
                <span className="flex flex-col gap-1">
                  <span className="font-sans text-xs/4 text-[#8A8A8A]">
                    {turn.sources}
                  </span>
                  <span className="font-sans text-[0.9375rem]/5.5 text-[#1E1E1E] dark:text-neutral-200">
                    {turn.answer}
                  </span>
                </span>
                <span className="shrink-0">
                  <RankBadge rank={turn.rank} size="md" />
                </span>
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

function CrawlerMock() {
  return (
    <span className={CLASSES.mockSlot}>
      <span className={cn(CLASSES.mockCard, "w-155")}>
        <NavbarBentoMockHeader
          meta="usenotra.com · last 60 minutes"
          title="Crawler log"
        >
          <span className="size-1.75 shrink-0 rounded-full bg-[#22A55A] shadow-[0_0_0_0.1875rem_#22A55A2E]" />
          <span className={CLASSES.mockPillLabel}>Live</span>
        </NavbarBentoMockHeader>
        <span className="flex flex-col pt-1.5 pb-2">
          {NAVBAR_PRODUCTS_CRAWLER_ROWS.map((row, index) => (
            <span
              className={cn(
                "flex items-center gap-3.5 px-5 py-2.75",
                index === 0 && "bg-[#F6F2FE] dark:bg-white/5"
              )}
              key={row.time}
            >
              <span className="w-15.5 shrink-0 font-mono text-xs/4 text-[#8A8A8A]">
                {row.time}
              </span>
              <span className="flex w-37 shrink-0 items-center gap-2.25">
                <NavbarEngineLogo engine={row.engine} />
                <span className="font-sans text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white">
                  {row.bot}
                </span>
              </span>
              <span className="grow basis-0 font-mono text-[0.8125rem]/4.5 text-[#1E1E1E] dark:text-neutral-200">
                {row.path}
              </span>
              <span className="flex w-28 shrink-0 justify-end">
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 font-sans text-xs/4 font-medium",
                    NAVBAR_PRODUCTS_PURPOSES[row.purpose].className
                  )}
                >
                  {NAVBAR_PRODUCTS_PURPOSES[row.purpose].label}
                </span>
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

function SitesMock() {
  return (
    <span className={CLASSES.mockSlot}>
      <span className={cn(CLASSES.mockCard, "w-128")}>
        <NavbarBentoMockHeader
          meta={NAVBAR_PRODUCTS_SITE.deployed}
          title={NAVBAR_PRODUCTS_SITE.domain}
        >
          <Github aria-hidden="true" className="size-3.5 shrink-0" />
          <span className={CLASSES.mockPillLabel}>
            {SITES_STAGE_PUSH.branch}
          </span>
        </NavbarBentoMockHeader>
        <span className="flex flex-col pt-1.5 pb-2">
          {SITES_STAGE_POSTS.map((post) => (
            <span
              className={cn(
                "flex items-center gap-3 px-5 py-3",
                post.fresh && "bg-[#F6F2FE] dark:bg-white/5"
              )}
              key={post.path}
            >
              <img
                alt=""
                className="size-8 shrink-0 rounded-full"
                height={32}
                src={post.avatar}
                width={32}
              />
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className={cn(CLASSES.mockTitle, "truncate")}>
                  {post.title}
                </span>
                <span className={CLASSES.mockMeta}>{post.date}</span>
              </span>
              <span className="shrink-0">
                {post.fresh ? (
                  <StatusBadge
                    appearance={SITES_STAGE_BADGES.publishedAppearance}
                    label={SITES_STAGE_BADGES.published}
                  />
                ) : (
                  <Badge shape="rounded" size="md" variant="success">
                    {SITES_STAGE_BADGES.live}
                  </Badge>
                )}
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

function IntegrationsMock() {
  return (
    <span className="absolute -top-6 left-0 flex flex-col gap-2.5">
      {NAVBAR_PRODUCTS_LOGO_ROWS.map((row, rowIndex) => (
        <span
          className={cn("flex gap-2.5", rowIndex !== 1 && "pl-9.25")}
          key={row.join("-")}
        >
          {row.map((logo) => {
            const { Logo, className } = NAVBAR_PRODUCTS_LOGOS[logo];
            return (
              <span className={CLASSES.logoTile} key={logo}>
                <Logo aria-hidden className={cn("size-7", className)} />
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

function TerminalMock() {
  return (
    <NavbarBentoWindow className="top-3 left-0 w-82.5" label="zsh">
      <span className="flex flex-col px-3.5 py-3 font-mono text-[0.8125rem]/5.25 whitespace-pre text-[#5B3FC4] dark:text-[#B9A4F5]">
        {NAVBAR_PRODUCTS_TERMINAL_LINES.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </NavbarBentoWindow>
  );
}

function ProductMock({ mock }: NavbarBentoMockProps<NavbarProductsMock>) {
  if (mock === "personas") {
    return <PersonasMock />;
  }
  if (mock === "conversations") {
    return <ConversationsMock />;
  }
  if (mock === "crawler") {
    return <CrawlerMock />;
  }
  if (mock === "sites") {
    return <SitesMock />;
  }
  if (mock === "integrations") {
    return <IntegrationsMock />;
  }
  return <TerminalMock />;
}

function ProductCard({
  card,
  onSelect,
}: {
  card: NavbarProductsCard;
  onSelect: () => void;
}) {
  return (
    <NavbarHref
      className={cn(PRODUCTS.card, card.tintClassName)}
      href={card.href}
      onClick={onSelect}
      role="menuitem"
    >
      <span className="sr-only">{`${card.label}. ${card.description}`}</span>
      <span aria-hidden="true" className={PRODUCTS.copy}>
        <span className={cn(PRODUCTS.icon, card.iconClassName)}>
          <HugeiconsIcon
            className="size-3.5 text-white"
            icon={card.icon}
            strokeWidth={2.4}
          />
        </span>
        <span className={PRODUCTS.title}>{card.label}</span>
        <span className={PRODUCTS.description}>{card.description}</span>
      </span>
      <span aria-hidden="true" className={PRODUCTS.mockArea}>
        <span className={PRODUCTS.mockStage}>
          <ProductMock mock={card.mock} />
        </span>
        <span className={PRODUCTS.mockFade} />
      </span>
    </NavbarHref>
  );
}

export function NavbarProductsPanel({ onSelect }: NavbarBentoPanelProps) {
  return (
    <div className={cn(CLASSES.panel, PRODUCTS.panel)}>
      <div className={PRODUCTS.cards}>
        {NAVBAR_PRODUCTS_CARDS.map((card) => (
          <ProductCard card={card} key={card.href} onSelect={onSelect} />
        ))}
      </div>
      <div className={CLASSES.row}>
        {NAVBAR_PRODUCTS_LINK_TILES.map((tile) => (
          <NavbarBentoLinkTile
            key={tile.href}
            link={tile}
            onSelect={onSelect}
            style={tile}
          >
            <ProductMock mock={tile.mock} />
          </NavbarBentoLinkTile>
        ))}
      </div>
    </div>
  );
}
