export const COMPOSER_QUEUED_CHIP =
  "hover:border-border hover:bg-background w-full border-solid border-transparent bg-transparent transition-colors";

export const COMPOSER_QUEUED_CHIP_LABEL = "min-w-0 flex-1 max-w-none";

/** Filled stop square for the composer's send button while a response streams. */
export const COMPOSER_STOP_ICON = [
  [
    "rect",
    {
      x: "5",
      y: "5",
      width: "14",
      height: "14",
      rx: "3.5",
      fill: "currentColor",
      key: "0",
    },
  ],
] as const;
