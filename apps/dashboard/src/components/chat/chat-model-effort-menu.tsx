"use client";

import { UnfoldMoreIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { thinkingLevelSchema } from "@notra/ai/schemas/chat";
import type { ThinkingLevel } from "@notra/ai/types/chat";
import { ModelSelectorLogo } from "@notra/ui/components/ai-elements/model-selector";
import { Composer } from "@notra/ui/components/ui/composer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { useTranslations } from "use-intl";

import type {
  ChatModelEffortMenuProps,
  ChatModelProvider,
} from "@/types/components/chat-input";

function ChatModelLogo({ provider }: { provider: ChatModelProvider }) {
  if (provider === "auto") {
    return <Notra className="size-3.5 shrink-0" />;
  }
  return (
    <ModelSelectorLogo className="size-3.5 shrink-0" provider={provider} />
  );
}

export function ChatModelEffortMenu({
  availableModels,
  disabled = false,
  model,
  onModelChange,
  onThinkingLevelChange,
  thinkingLevel,
}: ChatModelEffortMenuProps) {
  const t = useTranslations("chat.input.modelEffort");
  const tCommon = useTranslations("common");
  const currentModel =
    availableModels.find((option) => option.id === model) ?? availableModels[0];
  const effortLabel = (level: ThinkingLevel) =>
    level === "off" ? tCommon("labels.off") : tCommon(`labels.${level}`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Composer.ToolbarButton
            aria-label={t("label")}
            className="min-w-0"
            disabled={disabled}
          />
        }
      >
        {currentModel ? (
          <ChatModelLogo provider={currentModel.provider} />
        ) : null}
        <span className="text-foreground truncate">{currentModel?.label}</span>
        <span className="shrink-0">{effortLabel(thinkingLevel)}</span>
        <HugeiconsIcon className="size-3 shrink-0" icon={UnfoldMoreIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" side="top">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t("effort")}
            <span className="text-muted-foreground flex-1 pl-3 text-right">
              {effortLabel(thinkingLevel)}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {thinkingLevelSchema.options.map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() => onThinkingLevelChange(level)}
              >
                {effortLabel(level)}
                {thinkingLevel === level ? (
                  <HugeiconsIcon
                    className="text-primary ml-auto size-3.5"
                    icon={Tick02Icon}
                  />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t("model")}
            <span className="text-muted-foreground min-w-0 flex-1 truncate pl-3 text-right">
              {currentModel?.label}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {availableModels.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onClick={() => onModelChange(option.id)}
              >
                <ChatModelLogo provider={option.provider} />
                {option.label}
                {model === option.id ? (
                  <HugeiconsIcon
                    className="text-primary ml-auto size-3.5"
                    icon={Tick02Icon}
                  />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
