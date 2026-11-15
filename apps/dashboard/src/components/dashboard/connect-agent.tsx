"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { CopyStateIcon } from "@notra/ui/components/ui/copy-button";
import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Grok } from "@notra/ui/components/ui/svgs/grok";
import { GrokDark } from "@notra/ui/components/ui/svgs/grokDark";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { OpenaiDark } from "@notra/ui/components/ui/svgs/openaiDark";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@notra/ui/hooks/use-copy-to-clipboard";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { localStorageKeys } from "@/constants/storage";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useStoredDismissal } from "@/lib/hooks/use-stored-dismissal";
import type {
  ConnectAgentDismissButtonProps,
  ConnectAgentSwapLabelProps,
} from "@/types/connect-agent";
import { getConnectAgentPrompt } from "@/utils/connect-agent";
import { toastCopyError } from "@/utils/copy-to-clipboard";

// Solid circles, so each logo covers the one to its left.
const LOGO_CLASSNAME =
  "bg-background border-foreground/15 relative grid size-7 shrink-0 place-items-center rounded-full border";

// Same label swap as CopyButton: the old label leaves upwards, the new one
// rises in 70ms later.
const SWAP_IN_CLASSNAME = "animate-button-swap-in [animation-delay:70ms]";
const SWAP_OUT_CLASSNAME = "animate-button-swap-out";

const PILL_HIDDEN = { opacity: 0, height: 0, paddingBottom: 0, scale: 0.96 };
const PILL_SHOWN = { opacity: 1, height: "auto", paddingBottom: 6, scale: 1 };

const PILL_TRANSITION = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
  opacity: { duration: 0.12 },
} as const;

function AgentLogoStack() {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      <span className={LOGO_CLASSNAME}>
        <ClaudeAiIcon className="size-3.5" />
      </span>
      <span className={cn(LOGO_CLASSNAME, "-ms-2")}>
        <Openai className="size-3.5 dark:hidden" />
        <OpenaiDark className="hidden size-3.5 dark:block" />
      </span>
      <span className={cn(LOGO_CLASSNAME, "-ms-2")}>
        <Grok className="size-3.5 dark:hidden" />
        <GrokDark className="hidden size-3.5 dark:block" />
      </span>
    </span>
  );
}

function pillMotion(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return { initial: PILL_HIDDEN, animate: PILL_SHOWN, exit: PILL_HIDDEN };
}

function SwapLabel({
  copied,
  animate,
  label,
  copiedLabel,
}: ConnectAgentSwapLabelProps) {
  const labelAnimation = copied ? SWAP_OUT_CLASSNAME : SWAP_IN_CLASSNAME;
  const copiedAnimation = copied ? SWAP_IN_CLASSNAME : SWAP_OUT_CLASSNAME;

  return (
    <span className="grid min-w-0 flex-1 text-start">
      <span
        aria-hidden={copied}
        className={cn(
          "col-start-1 row-start-1 truncate motion-reduce:animate-none",
          animate && labelAnimation,
          copied && "opacity-0"
        )}
      >
        {label}
      </span>
      <span
        aria-hidden={!copied}
        className={cn(
          "col-start-1 row-start-1 motion-reduce:animate-none",
          animate && copiedAnimation,
          !copied && "opacity-0"
        )}
      >
        {copiedLabel}
      </span>
    </span>
  );
}

function DismissButton({ label, onDismiss }: ConnectAgentDismissButtonProps) {
  return (
    <button
      aria-label={label}
      className="border-sidebar-border bg-background text-muted-foreground hover:text-foreground focus-visible:ring-sidebar-ring pointer-events-none absolute -top-1.5 -right-1 grid size-5 scale-90 cursor-pointer place-items-center rounded-full border opacity-0 shadow-xs transition-[opacity,scale,color] duration-150 ease-out outline-none group-hover/agent:pointer-events-auto group-hover/agent:scale-100 group-hover/agent:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
      onClick={onDismiss}
      type="button"
    >
      <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
    </button>
  );
}

function useConnectAgentCopy() {
  const t = useTranslations("connectAgent");
  const { activeOrganization } = useOrganizationsContext();
  const { copied, copy } = useCopyToClipboard({ onError: toastCopyError });
  const [hasCopied, setHasCopied] = useState(false);
  const prompt = getConnectAgentPrompt(activeOrganization);

  async function copyPrompt() {
    if (!(await copy(prompt))) {
      return;
    }
    setHasCopied(true);
    toast.success(t("toast"));
    trackEvent(POSTHOG_EVENTS.AGENT_ONBOARD_PROMPT_COPIED);
  }

  return { prompt, copied, hasCopied, copyPrompt };
}

export function ConnectAgentPill() {
  const t = useTranslations("connectAgent");
  const tCommon = useTranslations("common");
  const reduceMotion = useReducedMotion();
  // The dismissal lives in localStorage, which the server can't read, so the
  // pill only renders in the browser to avoid flashing for dismissed users.
  const isClient = useIsClient();
  const { dismissed, dismiss } = useStoredDismissal(
    localStorageKeys.connectAgentDismissed
  );
  const { prompt, copied, hasCopied, copyPrompt } = useConnectAgentCopy();
  const visible = isClient && !dismissed;

  function handleDismiss() {
    dismiss();
    trackEvent(POSTHOG_EVENTS.AGENT_ONBOARD_PROMPT_DISMISSED);
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence initial={false}>
        {visible ? (
          <m.div
            className="group/agent relative pb-1.5 group-data-[collapsible=icon]:hidden"
            transition={PILL_TRANSITION}
            {...pillMotion(reduceMotion)}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    aria-label={copied ? tCommon("actions.copied") : t("label")}
                    className="border-sidebar-border bg-background text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring duration-fast flex h-9 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-full border ps-1 pe-3 text-sm font-medium transition-all ease-out outline-none focus-visible:ring-2 active:scale-[0.97] motion-reduce:transition-none"
                    onClick={copyPrompt}
                    type="button"
                  />
                }
              >
                <AgentLogoStack />
                <SwapLabel
                  animate={hasCopied}
                  copied={copied}
                  copiedLabel={tCommon("actions.copied")}
                  label={t("label")}
                />
                <span className="text-muted-foreground shrink-0">
                  <CopyStateIcon copied={copied} iconClassName="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64" side="right" sideOffset={8}>
                {prompt}
              </TooltipContent>
            </Tooltip>
            <DismissButton label={t("dismiss")} onDismiss={handleDismiss} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
