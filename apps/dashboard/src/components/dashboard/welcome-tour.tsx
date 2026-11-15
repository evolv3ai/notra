"use client";

import {
  ArrowUp02Icon,
  NoteIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@notra/ui/components/ui/dialog";
import { SPRING, tween } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from "motion/react";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EngineIcon } from "@/components/geo/engine-icon";
import {
  WELCOME_TOUR_ENGINES,
  WELCOME_TOUR_RANKING,
  WELCOME_TOUR_SKELETON_LINES,
  WELCOME_TOUR_STEPS,
} from "@/constants/welcome-tour";
import type {
  WelcomeTourProps,
  WelcomeTourSceneProps,
} from "@/types/components/welcome-tour";

const CARD_CLASS = "bg-background shadow-sm ring-1 ring-foreground/10";

function AskScene() {
  const t = useTranslations("dashboard.welcomeTour.scenes.ask");
  return (
    <div className="flex flex-col items-center">
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          CARD_CLASS,
          "flex w-72 items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4"
        )}
        initial={{ opacity: 0, y: 8 }}
        transition={SPRING.gentle}
      >
        <span className="truncate text-xs">{t("prompt")}</span>
        <span className="bg-foreground text-background ml-auto flex size-6 shrink-0 items-center justify-center rounded-full">
          <HugeiconsIcon className="size-3.5" icon={ArrowUp02Icon} />
        </span>
      </m.div>
      <svg
        aria-hidden="true"
        className="text-foreground/15 h-7 w-[228px] overflow-visible"
        fill="none"
        viewBox="0 0 228 28"
      >
        {WELCOME_TOUR_ENGINES.map((engine, index) => {
          const x = 24 + index * 60;
          return (
            <m.path
              animate={{ pathLength: 1 }}
              d={`M114 0 C114 14, ${x} 14, ${x} 28`}
              initial={{ pathLength: 0 }}
              key={engine}
              stroke="currentColor"
              strokeWidth="1.5"
              transition={{ ...tween("slower", "emphasized"), delay: 0.15 }}
            />
          );
        })}
      </svg>
      <div className="flex gap-3">
        {WELCOME_TOUR_ENGINES.map((engine, index) => (
          <m.span
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              CARD_CLASS,
              "flex size-12 items-center justify-center rounded-2xl"
            )}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            key={engine}
            transition={{ ...SPRING.gentle, delay: 0.3 + index * 0.06 }}
          >
            <EngineIcon className="size-5" engine={engine} />
          </m.span>
        ))}
      </div>
    </div>
  );
}

function RankScene({ brandName }: Pick<WelcomeTourSceneProps, "brandName">) {
  const t = useTranslations("dashboard.welcomeTour.scenes.rank");
  return (
    <div className={cn(CARD_CLASS, "w-72 rounded-xl p-1.5")}>
      <p className="text-muted-foreground px-2.5 pt-1 pb-1.5 text-xs font-medium">
        {t("label")}
      </p>
      {WELCOME_TOUR_RANKING.map((row, index) => {
        const isYou = row.key === "you";
        const label = isYou ? brandName || t("you") : t(row.key);
        return (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2",
              isYou && "bg-primary/8"
            )}
            initial={{ opacity: 0, y: 6 }}
            key={row.key}
            transition={{ ...SPRING.gentle, delay: index * 0.07 }}
          >
            <span className="text-muted-foreground w-2 text-xs tabular-nums">
              {index + 1}
            </span>
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold uppercase",
                isYou
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {label.charAt(0)}
            </span>
            <span className="w-20 truncate text-xs font-medium">{label}</span>
            <span className="bg-foreground/8 h-1.5 flex-1 overflow-hidden rounded-full">
              <m.span
                animate={{ scaleX: row.share / 100 }}
                className={cn(
                  "block h-full origin-left rounded-full",
                  isYou ? "bg-primary" : "bg-foreground/25"
                )}
                initial={{ scaleX: 0 }}
                transition={{
                  ...tween("slower", "emphasized"),
                  delay: 0.2 + index * 0.07,
                }}
              />
            </span>
            <span className="text-muted-foreground w-7 text-right text-xs tabular-nums">
              {row.share}%
            </span>
          </m.div>
        );
      })}
    </div>
  );
}

function GapsScene() {
  const t = useTranslations("dashboard.welcomeTour.scenes.gaps");
  return (
    <div className="relative h-36 w-72">
      <m.div
        animate={{ opacity: 1, x: 0 }}
        className={cn(CARD_CLASS, "absolute top-0 left-0 w-56 rounded-xl p-3")}
        initial={{ opacity: 0, x: -8 }}
        transition={SPRING.gentle}
      >
        <p className="text-warning flex items-center gap-1.5 text-xs font-medium">
          <span className="size-1.5 rounded-full bg-current" />
          {t("gap")}
        </p>
        <p className="mt-1.5 truncate text-xs font-medium">{t("prompt")}</p>
      </m.div>
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          CARD_CLASS,
          "absolute right-0 bottom-0 w-56 rounded-xl p-3 shadow-md"
        )}
        initial={{ opacity: 0, y: 12 }}
        transition={{ ...SPRING.gentle, delay: 0.2 }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <HugeiconsIcon className="size-3.5" icon={NoteIcon} />
            {t("draft")}
          </span>
          <span className="bg-success/10 text-success flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            <HugeiconsIcon className="size-3" icon={Tick02Icon} />
            {t("ready")}
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          {WELCOME_TOUR_SKELETON_LINES.map((width, index) => (
            <m.span
              animate={{ scaleX: 1 }}
              className={cn(
                "bg-foreground/10 block h-1.5 origin-left rounded-full",
                width
              )}
              initial={{ scaleX: 0 }}
              key={width}
              transition={{
                ...tween("slower", "emphasized"),
                delay: 0.35 + index * 0.08,
              }}
            />
          ))}
        </div>
      </m.div>
    </div>
  );
}

function WelcomeTourScene({ brandName, step }: WelcomeTourSceneProps) {
  if (step === "ask") {
    return <AskScene />;
  }
  if (step === "rank") {
    return <RankScene brandName={brandName} />;
  }
  return <GapsScene />;
}

export function WelcomeTour({ brandName, onClose }: WelcomeTourProps) {
  const t = useTranslations("dashboard.welcomeTour");
  const tActions = useTranslations("common.actions");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const step = WELCOME_TOUR_STEPS[index] ?? "ask";
  const isLast = index === WELCOME_TOUR_STEPS.length - 1;

  const goTo = (next: number) => {
    if (next < 0) {
      return;
    }
    if (next >= WELCOME_TOUR_STEPS.length) {
      onClose();
      return;
    }
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-[440px]"
        closeLabel={t("skip")}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" && !isLast) {
            goTo(index + 1);
          } else if (event.key === "ArrowLeft") {
            goTo(index - 1);
          }
        }}
      >
        <LazyMotion features={domAnimation} strict>
          <MotionConfig reducedMotion="user">
            <div className="bg-muted/40 relative flex h-60 items-center justify-center overflow-hidden border-b">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(var(--color-foreground)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)] bg-size-[16px_16px] opacity-10"
              />
              <div
                aria-hidden="true"
                className="bg-primary/15 absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              />
              <AnimatePresence initial={false} mode="popLayout">
                <m.div
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  className="relative"
                  exit={{ opacity: 0, x: -24 * direction, filter: "blur(4px)" }}
                  initial={{
                    opacity: 0,
                    x: 24 * direction,
                    filter: "blur(4px)",
                  }}
                  key={step}
                  transition={tween("slow", "emphasized")}
                >
                  <WelcomeTourScene brandName={brandName} step={step} />
                </m.div>
              </AnimatePresence>
            </div>
            <div className="px-6 pt-5 pb-6">
              <p className="text-muted-foreground text-xs font-medium tabular-nums">
                {t("progress", {
                  current: index + 1,
                  total: WELCOME_TOUR_STEPS.length,
                })}
              </p>
              <DialogTitle className="mt-1.5 text-lg font-semibold text-balance">
                {t(`steps.${step}.title`)}
              </DialogTitle>
              <DialogDescription className="mt-1.5 min-h-10">
                {t(`steps.${step}.description`)}
              </DialogDescription>
            </div>
            <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
              <div aria-hidden="true" className="flex gap-1.5">
                {WELCOME_TOUR_STEPS.map((key, keyIndex) => (
                  <span
                    className="bg-foreground/10 h-1 w-6 overflow-hidden rounded-full"
                    key={key}
                  >
                    <m.span
                      animate={{ scaleX: keyIndex <= index ? 1 : 0 }}
                      className="bg-foreground block h-full origin-left rounded-full"
                      initial={false}
                      transition={tween("slow", "emphasized")}
                    />
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                {index > 0 ? (
                  <Button onClick={() => goTo(index - 1)} variant="ghost">
                    {tActions("back")}
                  </Button>
                ) : null}
                <Button onClick={() => goTo(index + 1)}>
                  {isLast ? t("finish") : tActions("next")}
                </Button>
              </div>
            </div>
          </MotionConfig>
        </LazyMotion>
      </DialogContent>
    </Dialog>
  );
}
