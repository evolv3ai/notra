export const COMPOSER_TRAY_TRANSITION =
  "transition-[background-color,padding] duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none";

export const COMPOSER_NUDGE_TRANSITION = {
  duration: 0.3,
  ease: [0.65, 0, 0.35, 1],
} as const;

export const COMPOSER_INPUT =
  "block max-h-50 min-h-12 min-w-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-3 py-2 text-foreground text-sm leading-6 caret-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent md:text-sm dark:bg-transparent dark:disabled:bg-transparent";

export const COMPOSER_TOOLBAR_BUTTON =
  "rounded-md text-muted-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50";

export const COMPOSER_TOOLBAR_BUTTON_LABEL = "px-2 text-sm";

export const COMPOSER_SEND_BUTTON =
  "size-8 data-disabled:not-aria-busy:opacity-100";

/** Dense send for single-line inline composers like comment replies. */
export const COMPOSER_SEND_BUTTON_SM =
  "size-7 data-disabled:not-aria-busy:opacity-100 [&_svg:not([class*='size-'])]:size-3.5";

export const COMPOSER_SEND_ACTIVE = "";

export const COMPOSER_SEND_INERT =
  "text-muted-foreground/70 hover:brightness-100 data-disabled:not-aria-busy:cursor-default";

export const COMPOSER_CHIP_ACTION =
  "size-4 rounded text-muted-foreground hover:bg-accent";
