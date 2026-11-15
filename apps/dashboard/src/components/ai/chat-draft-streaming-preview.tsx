"use client";

import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import type { ChatDraftStreamingPreviewProps } from "@/types/components/chat-draft-streaming-preview";

const FADE_AFTER_CHARS = 400;

// The draft streams in as tool input; showing its tail keeps a minute-long
// generation visibly moving instead of hiding behind a status label.
export function ChatDraftStreamingPreview({
  markdown,
  title,
}: ChatDraftStreamingPreviewProps) {
  const tCommon = useTranslations("common");

  return (
    <div
      aria-busy
      className="border-border bg-muted/20 duration-normal ease-emphasized translate-y-0 overflow-hidden rounded-lg border opacity-100 transition-[opacity,transform] motion-reduce:transition-none starting:translate-y-1.5 starting:opacity-0"
    >
      <p
        className={
          title
            ? "text-foreground truncate px-3 pt-2.5 text-sm font-medium"
            : "text-muted-foreground truncate px-3 pt-2.5 text-sm"
        }
      >
        {title || tCommon("labels.untitled")}
      </p>
      {markdown ? (
        <div
          className={cn(
            "flex max-h-56 flex-col justify-end overflow-hidden px-3 pb-2.5",
            markdown.length > FADE_AFTER_CHARS && "mask-t-from-60%"
          )}
        >
          <MessageResponse
            className="text-muted-foreground text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            isAnimating
          >
            {markdown}
          </MessageResponse>
        </div>
      ) : (
        <div className="pb-2.5" />
      )}
    </div>
  );
}
