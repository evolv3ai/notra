"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { AuthFormHeader } from "@notra/ui/components/shared/auth/auth-form-header";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { OpenaiDark } from "@notra/ui/components/ui/svgs/openaiDark";
import { useState } from "react";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { OnboardingConnectPreview } from "@/components/onboarding/connect-preview";
import { OnboardingStepViewTracker } from "@/components/onboarding/step-view-tracker";
import { ONBOARDING_STEPS } from "@/constants/analytics-events";
import {
  NOTRA_CHATGPT_APP_URL,
  NOTRA_CLAUDE_DIRECTORY_URL,
  NOTRA_MCP_DOCS_URL,
} from "@/constants/onboarding";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { cn } from "@/lib/utils";
import type {
  ConnectStepProps,
  OnboardingConnectClient,
} from "@/types/onboarding";

export function ConnectStep({ companyName, nextHref }: ConnectStepProps) {
  const t = useTranslations("onboarding.connect");
  const tCommon = useTranslations("common");
  const [active, setActive] = useState<OnboardingConnectClient>("chatgpt");
  const track = (client: OnboardingConnectClient) =>
    trackEvent(POSTHOG_EVENTS.ONBOARDING_MCP_CONNECT_CLICKED, { client });
  const openaiIcon = (
    <>
      <Openai className="block size-4 dark:hidden" />
      <OpenaiDark className="hidden size-4 dark:block" />
    </>
  );
  const clients = [
    { id: "chatgpt", icon: openaiIcon, href: NOTRA_CHATGPT_APP_URL },
    {
      id: "claude",
      icon: <ClaudeAiIcon className="size-4" />,
      href: NOTRA_CLAUDE_DIRECTORY_URL,
    },
  ] as const;

  return (
    <div className="flex w-full flex-col gap-5">
      <OnboardingStepViewTracker step={ONBOARDING_STEPS.CONNECT} />
      <OnboardingConnectPreview client={active} companyName={companyName} />
      <AuthFormHeader description={t("description")} title={t("title")} />

      <ul className="grid grid-cols-1 gap-2">
        {clients.map((client) => (
          <li className="min-w-0" key={client.id}>
            <a
              className={cn(
                "border-input hover:bg-muted/40 flex w-full min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors",
                active === client.id && "border-primary/40 bg-primary/5"
              )}
              href={client.href}
              onClick={() => track(client.id)}
              onFocus={() => setActive(client.id)}
              onPointerEnter={() => setActive(client.id)}
              rel="noopener"
              target="_blank"
            >
              <span className="bg-background flex size-8 shrink-0 items-center justify-center rounded-md border">
                {client.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {t(`${client.id}.title`)}
                </span>
                <span className="text-muted-foreground line-clamp-1 text-xs">
                  {t(`${client.id}.description`)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="border-input text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border"
              >
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <CtaButton
        className="w-full"
        nativeButton={false}
        render={<Link href={nextHref} />}
      >
        {tCommon("actions.continue")}
      </CtaButton>

      <div className="text-center">
        <a
          className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
          href={NOTRA_MCP_DOCS_URL}
          rel="noopener"
          target="_blank"
        >
          {t("mcp")}
        </a>
      </div>
    </div>
  );
}
