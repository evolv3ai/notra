"use client";

import { normalizeWebsiteUrl } from "@notra/geo-core/utils/geo-website";
import { useId, useRef } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { WebsiteDiscoveryStatusProps } from "@/types/onboarding";

export function WebsiteDiscoveryStatus({
  host,
  isReading,
  failed,
  onRetry,
}: WebsiteDiscoveryStatusProps) {
  const t = useTranslations("onboarding.visibility");
  const tCommon = useTranslations("common");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const retry = () => {
    const normalized = normalizeWebsiteUrl(inputRef.current?.value ?? "");
    if (normalized) {
      onRetry(normalized);
    }
  };

  if (isReading) {
    return (
      <p className="text-muted-foreground text-xs wrap-anywhere">
        {t("reading", { host })}
      </p>
    );
  }
  if (!failed) {
    return null;
  }
  return (
    <div className="grid gap-2">
      <p className="text-destructive text-sm wrap-anywhere">
        {t("readFailed", { host })}
      </p>
      <div className="flex items-center gap-2">
        <div className="border-input focus-within:border-ring focus-within:ring-ring/50 flex h-11 min-w-0 flex-1 flex-row items-center overflow-hidden rounded-xl border transition-colors focus-within:ring-[3px]">
          <label
            className="border-input bg-muted/30 text-muted-foreground flex h-full items-center border-r px-3.5 text-sm"
            htmlFor={id}
          >
            https://
          </label>
          <input
            aria-label={tCommon("labels.website")}
            className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-sm outline-none"
            defaultValue={host}
            id={id}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                retry();
              }
            }}
            placeholder="acme.com"
            ref={inputRef}
            type="text"
          />
        </div>
        <Button
          className="h-11 shrink-0"
          onClick={retry}
          type="button"
          variant="outline"
        >
          {tCommon("actions.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
