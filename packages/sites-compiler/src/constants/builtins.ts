import { SITE_INJECTED_REACT_HOOKS } from "@notra/sites-core/constants/sites";

export const BUILTIN_COMPONENTS = [
  "Note",
  "Tip",
  "Info",
  "Warning",
  "Check",
  "Danger",
  "Callout",
  "Card",
  "CardGroup",
  "Columns",
  "Tabs",
  "Tab",
  "Accordion",
  "AccordionGroup",
  "Steps",
  "Step",
  "CodeGroup",
  "Frame",
  "Badge",
  "Update",
  "Video",
  "YouTube",
  "ThemeToggle",
  "SiteAreas",
  "PrivacySettings",
] as const;

export const BUILTIN_COMPONENT_PROPS: Record<
  (typeof BUILTIN_COMPONENTS)[number],
  readonly string[]
> = {
  Note: ["title"],
  Tip: ["title"],
  Info: ["title"],
  Warning: ["title"],
  Check: ["title"],
  Danger: ["title"],
  Callout: ["variant", "title"],
  Card: ["title", "href", "img", "cta"],
  CardGroup: ["cols"],
  Columns: ["cols"],
  Tabs: [],
  Tab: ["title"],
  Accordion: ["title", "defaultOpen"],
  AccordionGroup: [],
  Steps: [],
  Step: ["title"],
  CodeGroup: [],
  Frame: ["caption"],
  Badge: [],
  Update: ["label", "description"],
  Video: ["src", "poster", "title"],
  YouTube: ["id", "title"],
  ThemeToggle: [],
  SiteAreas: ["sections"],
  PrivacySettings: ["class", "className"],
};

export const BUILTIN_COMPONENT_NAMES = new Set<string>(BUILTIN_COMPONENTS);
export const INJECTED_HOOK_NAMES = new Set<string>(SITE_INJECTED_REACT_HOOKS);

export const BUILTINS_IMPORT_SOURCE = "@notra/builtins";
export const SITE_IMPORT_ALIAS = "@site";
export const INLINE_MODULE_SUFFIX = ".notra-inline.jsx";
export const IMPORTABLE_EXTENSIONS = [".mdx", ".md", ".jsx", ".js"] as const;

export const COMPONENT_NAME = /^[A-Z]/;

export const KNOWN_GLOBALS = new Set([
  "props",
  "Math",
  "Date",
  "JSON",
  "Number",
  "String",
  "Boolean",
  "Array",
  "Object",
  "Intl",
  "undefined",
  "NaN",
  "Infinity",
  "console",
  "window",
  "document",
  "navigator",
  "frontmatter",
]);

export const NODE_ONLY_GLOBALS = new Set([
  "process",
  "require",
  "module",
  "exports",
  "__dirname",
  "__filename",
  "Bun",
  "Deno",
  "Buffer",
]);
