import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";

export const TREND_BADGE_APPEARANCES = {
  up: {
    variant: "success",
    icon: ArrowUpRight01Icon,
    foreground: "text-badge-success",
  },
  down: {
    variant: "destructive",
    icon: ArrowDownRight01Icon,
    foreground: "text-badge-destructive",
  },
  flat: {
    variant: "secondary",
    icon: MinusSignIcon,
    foreground: "text-muted-foreground",
  },
} as const;

export const TREND_BADGE_PLAIN_SIZE_CLASSES = {
  sm: "gap-0.5 text-[0.625rem] [&>svg]:size-2.5",
  default: "gap-1 text-xs [&>svg]:size-3",
  md: "gap-1.5 text-sm [&>svg]:size-3.5",
} as const;
