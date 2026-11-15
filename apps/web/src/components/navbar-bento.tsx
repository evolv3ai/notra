import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";

import { NavbarHref } from "@/components/navbar-href";
import {
  NAVBAR_BENTO_CLASSES as CLASSES,
  NAVBAR_BENTO_WINDOW_DOTS,
} from "@/constants/navbar-bento";
import type {
  NavbarBentoFeatureTileProps,
  NavbarBentoLinkTileProps,
  NavbarBentoMockHeaderProps,
  NavbarBentoTileProps,
  NavbarBentoWindowProps,
} from "@/types/navbar-bento";

function NavbarBentoTile({
  link,
  onSelect,
  className,
  children,
}: NavbarBentoTileProps) {
  return (
    <NavbarHref
      className={cn(CLASSES.tile, className)}
      external={link.external}
      href={link.href}
      onClick={onSelect}
      role="menuitem"
    >
      <span className="sr-only">
        {link.description ? `${link.label}. ${link.description}` : link.label}
      </span>
      <span aria-hidden="true" className="contents">
        {children}
      </span>
    </NavbarHref>
  );
}

export function NavbarBentoFeatureTile({
  card,
  iconClassName,
  onSelect,
  className,
  children,
}: NavbarBentoFeatureTileProps) {
  return (
    <NavbarBentoTile
      className={cn(CLASSES.featureTile, className)}
      link={card}
      onSelect={onSelect}
    >
      <span className={CLASSES.featureHeader}>
        <span className={CLASSES.heading}>
          <span className={cn(CLASSES.icon, iconClassName)}>
            <HugeiconsIcon
              className="size-3 text-white"
              icon={card.icon}
              strokeWidth={2.4}
            />
          </span>
          <span className={CLASSES.title}>{card.label}</span>
        </span>
        <span className={CLASSES.description}>{card.description}</span>
      </span>
      <span className={cn(CLASSES.surface, CLASSES.mockArea)}>
        <span className={CLASSES.mockStage}>{children}</span>
        <span className={CLASSES.mockFade} />
      </span>
    </NavbarBentoTile>
  );
}

export function NavbarBentoLinkTile({
  link,
  style,
  onSelect,
  children,
}: NavbarBentoLinkTileProps) {
  return (
    <NavbarBentoTile
      className={cn(CLASSES.linkTile, style.className)}
      link={link}
      onSelect={onSelect}
    >
      <span className={cn(CLASSES.linkCopy, style.copyClassName)}>
        <span className={CLASSES.title}>{link.label}</span>
        <span className={CLASSES.description}>{link.description}</span>
      </span>
      <span className={cn(CLASSES.surface, CLASSES.linkMockArea)}>
        <span className={CLASSES.linkMockStage}>{children}</span>
        <span className={CLASSES.linkMockFade} />
      </span>
    </NavbarBentoTile>
  );
}

export function NavbarBentoMockHeader({
  title,
  meta,
  children,
}: NavbarBentoMockHeaderProps) {
  return (
    <span className={CLASSES.mockHeader}>
      <span className="flex flex-col gap-0.5">
        <span className={CLASSES.mockTitle}>{title}</span>
        <span className={CLASSES.mockMeta}>{meta}</span>
      </span>
      <span className="flex items-center rounded-[0.625rem] border border-[#E4E4E4] p-0.75 dark:border-white/10">
        <span className={CLASSES.mockPill}>{children}</span>
      </span>
    </span>
  );
}

export function NavbarBentoWindow({
  label,
  className,
  children,
}: NavbarBentoWindowProps) {
  return (
    <span
      className={cn(
        "absolute flex flex-col rounded-xl border border-[#1E1E1E14] bg-[#FAFAFA] dark:border-white/10 dark:bg-neutral-900",
        className
      )}
    >
      <span className="flex items-center justify-between border-b border-[#1E1E1E0F] px-3.5 py-2.5 dark:border-white/10">
        <span className="flex gap-1.5">
          {NAVBAR_BENTO_WINDOW_DOTS.map((dot) => (
            <span className={CLASSES.windowDot} key={dot} />
          ))}
        </span>
        <span className="font-mono text-[0.6875rem]/3.5 text-[#1E1E1E80] dark:text-white/50">
          {label}
        </span>
      </span>
      {children}
    </span>
  );
}
