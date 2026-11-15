"use client";

import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { useContext } from "react";
import { createPortal } from "react-dom";
import { ChatgptAppCall } from "ui/chatgpt/chatgpt-app-call";
import { ChatgptComposer } from "ui/chatgpt/chatgpt-composer";
import { ChatgptMessage } from "ui/chatgpt/chatgpt-message";
import { ClaudeComposer } from "ui/claude/claude-composer";
import { ClaudeMessage } from "ui/claude/claude-message";
import { ClaudeSearch } from "ui/claude/claude-search";
import { useTranslations } from "use-intl";

import { OnboardingPreviewTargetContext } from "@/components/onboarding/split-layout-context";
import type { OnboardingConnectPreviewProps } from "@/types/onboarding";

export function OnboardingConnectPreview({
  client,
  companyName,
}: OnboardingConnectPreviewProps) {
  const target = useContext(OnboardingPreviewTargetContext);
  const t = useTranslations("onboarding.connect.preview");
  if (!target) {
    return null;
  }

  const values = {
    companyName: companyName || t("fallbackName"),
    b: (chunks: React.ReactNode) => (
      <strong className="font-semibold">{chunks}</strong>
    ),
  };
  const question = t.rich("question", values);
  const answer = t.rich("answer", values);
  const logo = (
    <span className="flex size-full items-center justify-center rounded-[inherit] p-px dark:bg-[#F6F3F1]">
      <Notra />
    </span>
  );

  const body =
    client === "chatgpt" ? (
      <div className="bg-chatgpt-bg flex w-full max-w-2xl flex-col gap-8 rounded-3xl px-6 pt-8 pb-4 shadow-xl">
        <ChatgptMessage from="user">{question}</ChatgptMessage>
        <ChatgptMessage
          from="assistant"
          reasoning={
            <ChatgptAppCall label={t("usedVerb")} logo={logo} name="Notra" />
          }
        >
          {answer}
        </ChatgptMessage>
        <ChatgptComposer placeholder={t("composer")} />
      </div>
    ) : (
      <div className="bg-claude-bg flex w-full max-w-2xl flex-col gap-8 rounded-3xl px-6 pt-8 pb-4 shadow-xl">
        <ClaudeMessage from="user">{question}</ClaudeMessage>
        <ClaudeMessage
          from="assistant"
          search={
            <ClaudeSearch
              items={[{ label: t("used"), tool: "Notra", type: "tool" }]}
              logo={logo}
              summary={t("used")}
            />
          }
        >
          <p className="text-base">{answer}</p>
        </ClaudeMessage>
        <ClaudeComposer disclaimer={null} placeholder={t("composer")} />
      </div>
    );

  return createPortal(
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center p-10"
      inert
    >
      {body}
    </div>,
    target
  );
}
