export const NAVBAR_BENTO_CLASSES = {
  panel: "flex w-[min(58rem,calc(100vw-3rem))] flex-col gap-3 p-3",
  row: "flex gap-3 self-stretch",
  tile: "group relative flex overflow-clip rounded-2xl border border-shell-border bg-shell p-0.5 transition-colors duration-normal ease-out hover:border-[#1E1E1E29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] dark:hover:border-white/20",
  featureTile: "grow basis-0 flex-col",
  featureHeader: "flex flex-col gap-1 px-3.5 pt-3 pb-3",
  heading: "flex items-center gap-2",
  surface:
    "pointer-events-none relative overflow-hidden rounded-[0.875rem] border border-table-card-border bg-table-card shadow-table-card",
  mockArea: "flex-1",
  mockStage:
    "absolute top-3.5 left-3.5 flex origin-top-left scale-75 transition-transform duration-slow ease-out group-hover:-translate-y-1.5",
  mockFade:
    "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-table-card to-transparent",
  linkTile: "h-20 basis-0 items-stretch",
  linkCopy: "flex shrink-0 flex-col justify-center px-3.5",
  linkMockArea: "grow",
  linkMockStage:
    "absolute inset-0 left-3 origin-top-left scale-75 transition-transform duration-slow ease-out group-hover:-translate-x-1.5",
  linkMockFade:
    "pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-table-card to-transparent",
  icon: "flex size-5 shrink-0 items-center justify-center rounded-md",
  title: "text-foreground font-sans text-sm/5 font-semibold tracking-[-0.01em]",
  description: "text-muted-foreground font-sans text-[0.8125rem]/4.5",
  mockSlot: "flex",
  mockCard:
    "flex shrink-0 flex-col overflow-clip rounded-2xl border border-table-card-border bg-table-card shadow-table-card",
  mockHeader:
    "flex items-center justify-between border-b border-[#EFEFEF] px-5 py-4 dark:border-white/10",
  mockTitle:
    "font-sans text-[0.9375rem]/5 font-semibold text-[#1E1E1E] dark:text-white",
  mockMeta: "font-sans text-[0.8125rem]/4 text-[#6B6B6B] dark:text-neutral-400",
  mockPill:
    "flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 shadow-[0_0.0625rem_0.125rem_#0000001A] dark:bg-white/10",
  mockPillLabel:
    "font-sans text-[0.8125rem]/4 font-medium text-[#1E1E1E] dark:text-white",
  logoTile:
    "flex size-16 shrink-0 items-center justify-center rounded-[0.875rem] border border-[#1E1E1E14] bg-white shadow-[0_0.0625rem_0.125rem_#28282814] dark:border-white/10 dark:bg-neutral-900",
  windowDot:
    "size-2.25 shrink-0 rounded-full border border-[#1E1E1E33] dark:border-white/20",
} as const;

export const NAVBAR_BENTO_TINTS = {
  violet: "bg-[#8B5CF6]",
  indigo: "bg-[#5B5BD6]",
  amber: "bg-[#E8833A]",
  green: "bg-[#16A34A]",
} as const;

export const NAVBAR_BENTO_WINDOW_DOTS = ["close", "minimize", "zoom"] as const;

export const NAVBAR_BENTO_TINT_CYCLE = [
  NAVBAR_BENTO_TINTS.violet,
  NAVBAR_BENTO_TINTS.indigo,
  NAVBAR_BENTO_TINTS.amber,
] as const;
