"use client";

import { Kbd } from "@notra/ui/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useIsApplePlatform } from "@notra/ui/hooks/use-is-apple-platform";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { CONTENT_DOCUMENT_TABS } from "@/constants/content-detail";
import { cn } from "@/lib/utils";
import type { ContentDocumentTabsProps } from "@/types/content/detail";

export function ContentDocumentTabs({
  columnClassName,
  enabled,
  value,
  onValueChange,
}: ContentDocumentTabsProps) {
  const t = useTranslations("content.detail.tabs");
  const isApplePlatform = useIsApplePlatform();
  const modifier = isApplePlatform ? "⌘" : "Ctrl";
  const [isModifierHeld, setIsModifierHeld] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  // The bar's divider only shows once text scrolls under it. The negative
  // margin and top cancel the viewport's padding, so the bar starts and
  // sticks flush under the header.
  useEffect(() => {
    const node = sentinel.current;
    if (!(enabled && node)) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(entry ? !entry.isIntersecting : false),
      { root: node.closest("[data-content-scroll-viewport]") }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  const selectTab = useEffectEvent(onValueChange);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      setIsModifierHeld(event.metaKey || event.ctrlKey);
      if (
        event.repeat ||
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const tab = CONTENT_DOCUMENT_TABS[Number(event.key) - 1];
      if (tab) {
        event.preventDefault();
        selectTab(tab);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      setIsModifierHeld(event.metaKey || event.ctrlKey);
    };
    const releaseModifier = () => setIsModifierHeld(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseModifier);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseModifier);
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <div aria-hidden="true" className="-mt-4 md:-mt-6" ref={sentinel} />
      <div
        className={cn(
          "bg-background duration-normal ease-emphasized sticky -top-4 z-10 mb-4 border-b transition-colors md:-top-6",
          isStuck ? "border-border" : "border-transparent"
        )}
      >
        <div
          className={cn("mx-auto w-full px-4 py-3 lg:px-6", columnClassName)}
        >
          <Tabs
            className="relative w-fit"
            onValueChange={(next) =>
              onValueChange(next === "outline" ? "outline" : "post")
            }
            value={value}
          >
            <TabsList>
              {CONTENT_DOCUMENT_TABS.map((tab, index) => (
                <Tooltip key={tab}>
                  <TooltipTrigger
                    render={
                      <TabsTrigger
                        aria-keyshortcuts={`${isApplePlatform ? "Meta" : "Control"}+${index + 1}`}
                        value={tab}
                      />
                    }
                  >
                    {t(tab)}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "bg-popover ring-border text-muted-foreground pointer-events-none absolute top-full left-1/2 mt-1.5 inline-flex h-6 origin-top -translate-x-1/2 items-center rounded-md px-1.5 text-xs font-medium shadow-sm ring-1 transition select-none motion-reduce:transition-opacity",
                        // Stagger the reveal left to right; hide all at once.
                        isModifierHeld
                          ? cn(
                              "ease-emphasized duration-normal opacity-100",
                              index > 0 && "delay-30"
                            )
                          : "ease-emphasized-in duration-instant -translate-y-1 scale-95 opacity-0 motion-reduce:translate-y-0 motion-reduce:scale-100"
                      )}
                    >
                      {modifier}
                      {index + 1}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t(tab)}
                    <Kbd>
                      {modifier}
                      {index + 1}
                    </Kbd>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
    </>
  );
}
