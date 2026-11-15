import {
  Globe02Icon,
  Image01Icon,
  LayoutBottomIcon,
  LayoutTopIcon,
  Megaphone01Icon,
  PaintBoardIcon,
  Plug01Icon,
  SeoIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";

/** The Design tab's sections, in sidebar order, with the blog.json paths each one edits. */
export const SITE_DESIGN_SECTIONS = [
  { id: "general", icon: Globe02Icon, paths: ["name", "description"] },
  {
    id: "styling",
    icon: PaintBoardIcon,
    paths: ["colors", "appearance", "background", "styling.codeblocks"],
  },
  {
    id: "branding",
    icon: Image01Icon,
    paths: ["logo", "favicon", "seo.image", "seo.imageAlt"],
  },
  { id: "typography", icon: TextFontIcon, paths: ["fonts"] },
  { id: "navbar", icon: LayoutTopIcon, paths: ["navbar"] },
  { id: "banner", icon: Megaphone01Icon, paths: ["banner"] },
  { id: "footer", icon: LayoutBottomIcon, paths: ["footer"] },
  { id: "integrations", icon: Plug01Icon, paths: ["integrations"] },
  { id: "seo", icon: SeoIcon, paths: ["seo.metatags", "seo.indexing"] },
] as const;

/** Labelled groups of Design sections in the site sidebar. */
export const SITE_DESIGN_GROUPS = [
  {
    id: "appearance",
    sections: ["general", "styling", "branding", "typography"],
  },
  { id: "layout", sections: ["navbar", "banner", "footer"] },
  { id: "configuration", sections: ["integrations", "seo"] },
] as const;
