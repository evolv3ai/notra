import type { SupportedLanguages, ThemesType } from "@pierre/diffs";

export const SITE_CODE_THEME: ThemesType = {
  light: "pierre-light",
  dark: "pierre-dark",
};

export const SITE_CODE_LANGUAGES: readonly SupportedLanguages[] = [
  "mdx",
  "markdown",
  "tsx",
  "jsx",
  "yaml",
  "json",
  "css",
  "shellscript",
];

export const SITE_CODE_SURFACE_CLASS =
  "[--diffs-font-family:var(--font-geist-mono)] [--diffs-header-font-family:var(--font-inter)] [--diffs-font-size:16px] [--diffs-line-height:26px] [--diffs-tab-size:2] [--diffs-min-number-column-width:3ch] [--diffs-gap-inline:12px] md:[--diffs-font-size:13px] md:[--diffs-line-height:22px]";

const SITE_CODE_BASE_CSS = `
:host {
  --diffs-light-bg: var(--background);
  --diffs-dark-bg: var(--background);
  --diffs-fg-number-override: color-mix(in oklab, var(--muted-foreground) 55%, transparent);
  --diffs-bg-selection-override: color-mix(in oklab, var(--primary) 16%, transparent);
  --diffs-bg-selection-number-override: color-mix(in oklab, var(--primary) 24%, transparent);
  --diffs-bg-caret-override: var(--foreground);
  --diffs-bg-separator-override: color-mix(in oklab, var(--muted) 70%, var(--background));
  --diffs-bg-buffer-override: var(--background);
}
`.trim();

export const SITE_CODE_DIFF_CSS = `
${SITE_CODE_BASE_CSS}
:host {
  --diffs-bg-context-override: var(--background);
  --diffs-bg-context-gutter-override: var(--background);
}
`.trim();
