"use client";

import { cn } from "@notra/ui/lib/utils";

import { Collapsible, CollapsibleTrigger } from "@notra/ui/components/ui/collapsible";

import type { AIOverviewProps } from "@notra/ui/types/google-ai-overview";
import { AIOverviewChevronIcon } from "@notra/ui/components/ai-skins/google-ai-overview/ai-overview-icons";

export const AIOverview = ({
  children,
  className,
  collapsible = true,
  open,
  render = <section />,
  showMoreLabel = "Show more",
  ...props
}: AIOverviewProps) => (
  <Collapsible
    className={cn(
      "group/ai-overview bg-aio-bg font-aio text-aio-fg relative text-base leading-6 font-normal antialiased",
      collapsible &&
        "data-closed:max-h-[var(--aio-collapsed-height,36.4375rem)] data-closed:overflow-y-clip",
      className
    )}
    data-slot="ai-overview"
    open={collapsible ? open : true}
    render={render}
    {...props}
  >
    {children}
    {collapsible && (
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-2 h-37 bg-[linear-gradient(transparent_0,color-mix(in_srgb,var(--aio-bg)_90%,transparent)_3.25rem,var(--aio-bg)_5rem)] group-data-open/ai-overview:hidden"
        />
        <div className="bg-aio-bg absolute inset-x-0 bottom-5 z-2 pb-0.5 group-data-open/ai-overview:hidden">
          <CollapsibleTrigger className="border-aio-button-border text-aio-button-fg hover:bg-aio-button-icon/[8.24%] focus-visible:outline-aio-focus active:bg-aio-button-icon/[22.4%] inline-flex h-12.5 w-full max-w-177 cursor-pointer items-center justify-center rounded-full border bg-transparent px-[0.9375rem] py-[0.6875rem] text-sm leading-5 font-medium whitespace-nowrap outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-solid">
            {showMoreLabel}
            <AIOverviewChevronIcon className="text-aio-button-icon ml-2 size-5" />
          </CollapsibleTrigger>
        </div>
      </>
    )}
  </Collapsible>
);
