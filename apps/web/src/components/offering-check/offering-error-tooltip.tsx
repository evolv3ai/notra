import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useEffect, useRef } from "react";

import { OFFERING_FIELD_SHAKE } from "@/constants/offering-check";
import type { OfferingErrorTooltipProps } from "@/types/offering-check";
import { getReducedMotionSnapshot } from "@/utils/reduced-motion";

export function OfferingErrorTooltip({
  error,
  attempt,
  inline = false,
  children,
}: OfferingErrorTooltipProps) {
  const field = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!(error && field.current?.animate) || getReducedMotionSnapshot()) {
      return;
    }
    const animation = field.current.animate(
      OFFERING_FIELD_SHAKE.keyframes,
      OFFERING_FIELD_SHAKE.timing
    );
    return () => animation.cancel();
  }, [error, attempt]);

  return (
    <Tooltip open={Boolean(error)}>
      <TooltipTrigger
        render={
          <span
            className={
              inline ? "inline-block max-w-full align-baseline" : "block"
            }
            ref={field}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {error}
      </TooltipContent>
    </Tooltip>
  );
}
