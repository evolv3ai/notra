import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { cn } from "@notra/ui/lib/utils";

import type { MockFrameProps } from "@/types/landing/features";

export function MockFrame({
  heading,
  subhead,
  className,
  children,
}: MockFrameProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "sm:border-border sm:bg-background @container pointer-events-none h-full w-full min-w-0 text-left select-none sm:rounded-2xl sm:border sm:p-4 sm:shadow-[0_0.125rem_1.4375rem_#0000001A,0_0.0625rem_0.125rem_#0000000A] sm:dark:shadow-none",
        className
      )}
    >
      <InstrumentSection
        className="max-sm:gap-0 [&_h2]:capitalize max-sm:[&>div:first-child]:hidden"
        description={subhead}
        eyebrow={heading}
      >
        <div className="border-border bg-card overflow-hidden rounded-xl border max-sm:shadow-[0_0.0625rem_0.125rem_#0A0D140A,0_0.25rem_1rem_#0A0D140F] max-sm:dark:shadow-none">
          {children}
        </div>
      </InstrumentSection>
    </div>
  );
}
