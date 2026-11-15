export const SELECT_COLLISION_AVOIDANCE = {
  side: "flip",
  align: "shift",
} as const;

export const DROPDOWN_POPUP_CLASS_NAME =
  "z-50 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-[0.875rem] border border-border bg-popover bg-linear-to-b from-background to-[color-mix(in_oklab,var(--color-background),var(--color-foreground)_2.5%)] text-popover-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-8px_rgba(0,0,0,0.16)] outline-none transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [corner-shape:squircle] data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.97] motion-safe:data-starting-style:scale-[0.97] motion-reduce:transition-none dark:border-input dark:from-muted dark:to-shell dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.3),0_16px_32px_-8px_rgba(0,0,0,0.6)]";

export const DROPDOWN_ITEM_CLASS_NAME =
  "relative flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[0.625rem] px-2.5 py-1.5 text-sm outline-hidden transition-colors duration-75 [corner-shape:squircle] data-highlighted:bg-menu-highlight data-highlighted:text-foreground dark:data-highlighted:shadow-menu-highlight data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 *:[svg]:text-muted-foreground data-highlighted:*:[svg]:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0";
