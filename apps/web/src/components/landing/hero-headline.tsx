import { tween } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import Scritto from "@scritto/react";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { createElement, useSyncExternalStore, type ReactNode } from "react";

import { LandingEngineIcon } from "@/components/landing/landing-engine-icon";
import { HERO_HEADLINE_SUFFIX } from "@/constants/landing/hero";
import type {
  CycleMarkProps,
  HeroHeadlineBrand,
  HeroCycleWord,
  HeroHeadlineProps,
} from "@/types/landing/hero";

const ICON_SLOT_CLASS =
  "relative ml-[0.22em] inline-flex size-[1cap] shrink-0 items-center justify-center overflow-visible align-baseline";

const ICON_SWAP = tween("slower", "emphasizedInOut");
const ICON_HIDDEN = { opacity: 0, transform: "scale(0.94)" } as const;
const ICON_SHOWN = { opacity: 1, transform: "scale(1)" } as const;

function subscribeIsClient() {
  return () => {};
}

export function useIsClient() {
  return useSyncExternalStore(
    subscribeIsClient,
    () => true,
    () => false
  );
}

export function CycleMark({
  markKey,
  animated,
  className,
  children,
}: CycleMarkProps) {
  return (
    <span className={cn(ICON_SLOT_CLASS, className)}>
      <AnimatePresence initial={false}>
        <m.span
          animate={ICON_SHOWN}
          className="absolute inset-0 flex items-center justify-center [&_img]:size-full [&_svg]:size-full"
          exit={animated ? ICON_HIDDEN : undefined}
          initial={animated ? ICON_HIDDEN : false}
          key={markKey}
          transition={animated ? ICON_SWAP : { duration: 0 }}
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

function EngineMark({
  engine,
  animated,
}: Pick<HeroCycleWord, "engine"> & { animated: boolean }) {
  return (
    <CycleMark animated={animated} markKey={engine}>
      <LandingEngineIcon className="size-full" engine={engine} />
    </CycleMark>
  );
}

export function HeadlineFlow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return createElement("scritto-flow", { className }, children);
}

function HeadlineLineTwo({
  word,
  prefix,
  animated,
}: {
  word: HeroCycleWord;
  prefix: string;
  animated: boolean;
}) {
  const morph = useIsClient();
  const name = morph ? (
    <Scritto
      animated={animated}
      className="ml-[0.16em] align-baseline"
      value={word.text}
    />
  ) : (
    <span className="ml-[0.16em] [font-kerning:none] [font-variant-ligatures:none]">
      {word.text}
    </span>
  );
  const line = (
    <>
      {prefix}{" "}
      <span className="inline-block whitespace-nowrap">
        <EngineMark animated={animated} engine={word.engine} />
        {name}
        {HERO_HEADLINE_SUFFIX}
      </span>
    </>
  );

  if (!morph) {
    return <span className="block text-[0.9em] sm:text-[1em]">{line}</span>;
  }

  return (
    <HeadlineFlow className="text-[0.9em] sm:text-[1em]" key={prefix}>
      {line}
    </HeadlineFlow>
  );
}

function HeadlineLineOne({ line }: { line: string | HeroHeadlineBrand }) {
  if (typeof line === "string") {
    return line;
  }

  const Icon = line.icon;

  return (
    <>
      {line.before}{" "}
      <span className="inline-block whitespace-nowrap">
        <CycleMark animated={false} className="ml-0" markKey={line.name}>
          <Icon
            aria-hidden="true"
            className={cn("size-full", line.iconClassName)}
          />
        </CycleMark>
        <span className="ml-[0.16em]">{line.name}</span>
      </span>{" "}
      {line.after}
    </>
  );
}

export function HeroHeadline({ word, lineOne, lineTwo }: HeroHeadlineProps) {
  const animated = useReducedMotion() === false;

  return (
    <LazyMotion features={domAnimation}>
      <h1 className="font-display w-full max-w-[56.875rem] text-center text-[clamp(1.625rem,calc(10.6vw_-_0.5rem),2.5rem)] leading-[1.08] font-medium tracking-[-0.015em] text-[#1E1E1E] sm:mx-auto sm:text-[clamp(3.25rem,7.3vw,4rem)] sm:font-semibold lg:text-[4.75rem] lg:leading-[1.12] dark:text-white">
        <span className="block text-balance">
          <HeadlineLineOne line={lineOne} />
        </span>
        {"headlineLineTwo" in lineTwo ? (
          <span className="block text-[0.9em] sm:text-[1em]">
            {lineTwo.headlineLineTwo}
            {HERO_HEADLINE_SUFFIX}
          </span>
        ) : (
          <HeadlineLineTwo
            animated={animated}
            prefix={lineTwo.headlineLineTwoPrefix}
            word={word}
          />
        )}
      </h1>
    </LazyMotion>
  );
}
