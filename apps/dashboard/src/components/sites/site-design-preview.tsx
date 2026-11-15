"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  SITE_DESIGN_PREVIEW_DARK_FOREGROUND,
  SITE_DESIGN_PREVIEW_DECORATION_CLASS_NAMES,
  SITE_DESIGN_PREVIEW_LIGHT_FOREGROUND,
  SITE_DESIGN_PREVIEW_NEUTRAL_CODE_CLASS_NAMES,
} from "@/constants/site-design";
import { cn } from "@/lib/utils";
import type {
  SiteBackgroundDecoration,
  SiteCodeThemeMode,
  SiteDesignPreviewColors,
  SiteMiniPageProps,
} from "@/types/site-design";

function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block h-1.5 rounded-full bg-[color-mix(in_oklab,var(--mini-fg)_15%,transparent)]",
        className
      )}
    />
  );
}

function CodeLines({ tone }: { tone: NonNullable<SiteMiniPageProps["code"]> }) {
  return (
    <span
      className={cn(
        "flex flex-col gap-1 rounded-sm p-1.5",
        tone === "dark" && "bg-zinc-900 ring-1 ring-white/10",
        tone === "light" && "bg-zinc-100 ring-1 ring-black/5",
        tone === "accent" &&
          "bg-[color-mix(in_oklab,var(--mini-accent)_14%,var(--mini-bg))] ring-1 ring-[color-mix(in_oklab,var(--mini-accent)_25%,transparent)]"
      )}
    >
      <span className="flex gap-1">
        <span
          className={cn(
            "block h-1 w-1/4 rounded-full",
            tone === "accent" ? "bg-(--mini-accent)" : "bg-chart-2/80"
          )}
        />
        <span
          className={cn(
            "block h-1 w-2/5 rounded-full",
            SITE_DESIGN_PREVIEW_NEUTRAL_CODE_CLASS_NAMES[tone]
          )}
        />
      </span>
      <span className="flex gap-1 pl-2">
        <span
          className={cn(
            "block h-1 w-1/5 rounded-full",
            tone === "accent" ? "bg-(--mini-accent)/60" : "bg-chart-4/80"
          )}
        />
        <span
          className={cn(
            "block h-1 w-1/3 rounded-full",
            SITE_DESIGN_PREVIEW_NEUTRAL_CODE_CLASS_NAMES[tone]
          )}
        />
      </span>
    </span>
  );
}

/** A tiny site page in one mode: navbar, heading, text, optional code block. */
function MiniPage({ colors, tone, code, className }: SiteMiniPageProps) {
  const background =
    tone === "light"
      ? colors.backgroundLight || "#FFFFFF"
      : colors.backgroundDark || "#09090B";
  const style = {
    "--mini-bg": background,
    "--mini-fg":
      tone === "light"
        ? SITE_DESIGN_PREVIEW_LIGHT_FOREGROUND
        : SITE_DESIGN_PREVIEW_DARK_FOREGROUND,
    "--mini-accent": colors.primary || "#6366F1",
  } as CSSProperties;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 bg-(--mini-bg) p-2.5",
        className
      )}
      style={style}
    >
      <span className="mb-0.5 flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full bg-(--mini-accent)" />
        <Bar className="w-1/5" />
        <span className="flex-1" />
        <Bar className="w-1/6" />
      </span>
      <span className="block h-2.5 w-3/5 rounded-full bg-[color-mix(in_oklab,var(--mini-fg)_35%,transparent)]" />
      {code ? (
        <CodeLines tone={code} />
      ) : (
        <>
          <Bar className="w-full" />
          <Bar className="w-4/5" />
          <Bar className="w-2/3" />
        </>
      )}
    </div>
  );
}

function PreviewFrame({
  children,
  split = false,
}: {
  children: ReactNode;
  split?: boolean;
}) {
  return (
    <div className="bg-muted flex h-28 items-center justify-center px-5">
      <div
        className={cn(
          "w-full overflow-hidden rounded-lg border shadow-xs",
          split && "grid grid-cols-2 divide-x"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Just the pattern on the page background; a fake page would hide it. */
export function SiteDecorationPreview({
  colors,
  decoration,
}: {
  colors: SiteDesignPreviewColors;
  decoration: SiteBackgroundDecoration;
}) {
  const style = {
    "--mini-bg": colors.backgroundLight || "#FFFFFF",
    "--mini-fg": SITE_DESIGN_PREVIEW_LIGHT_FOREGROUND,
    "--mini-accent": colors.primary || "#6366F1",
  } as CSSProperties;
  return (
    <div
      className={cn(
        "h-28 bg-(--mini-bg)",
        SITE_DESIGN_PREVIEW_DECORATION_CLASS_NAMES[decoration]
      )}
      style={style}
    />
  );
}

export function SiteCodeModePreview({
  colors,
  codeMode,
}: {
  colors: SiteDesignPreviewColors;
  codeMode: SiteCodeThemeMode;
}) {
  const codeFor = (tone: "light" | "dark") => {
    if (codeMode === "custom") {
      return "accent";
    }
    return codeMode === "dark" ? "dark" : tone;
  };
  return (
    <PreviewFrame split>
      <MiniPage code={codeFor("light")} colors={colors} tone="light" />
      <MiniPage code={codeFor("dark")} colors={colors} tone="dark" />
    </PreviewFrame>
  );
}
