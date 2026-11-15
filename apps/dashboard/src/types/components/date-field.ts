import type { PopoverContent } from "@notra/ui/components/ui/popover";
import type { ComponentProps, ReactNode } from "react";
import type { Matcher } from "react-day-picker";

export interface DateFieldProps {
  id?: string;
  "aria-labelledby"?: string;
  /** The picked day, shown selected in the calendar. */
  selected: Date | undefined;
  /** The picked day as text; the placeholder shows while it is missing. */
  display: ReactNode;
  placeholder: string;
  onSelect: (date: Date) => void;
  disabled?: boolean;
  /** Days that can't be picked. */
  disabledDays?: Matcher;
  /** Shown at the end of the trigger, like a mark for an automatic value. */
  trailing?: ReactNode;
  /** With `clearLabel`, adds a footer action that drops the picked day. */
  onClear?: () => void;
  clearLabel?: string;
  /** Positioning of the popover, for fields inside a scrolling panel. */
  contentProps?: Pick<
    ComponentProps<typeof PopoverContent>,
    "side" | "positionMethod" | "collisionAvoidance"
  >;
}

export interface TimeFieldProps {
  id: string;
  /** `HH:mm`, local time. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}
