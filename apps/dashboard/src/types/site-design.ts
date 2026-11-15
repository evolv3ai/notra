import type {
  SITE_NAVBAR_LINK_TYPES,
  SITE_SOCIAL_PLATFORMS,
} from "@notra/sites-core/constants/site-layout";
import type { SiteImageUploadKind } from "@notra/sites-core/types/uploads";
import type { ComponentType, ReactNode, SVGProps } from "react";

import type {
  SITE_APPEARANCE_MODES,
  SITE_BACKGROUND_DECORATIONS,
  SITE_BANNER_TYPES,
  SITE_CODE_THEME_MODES,
  SITE_FONT_FORMATS,
  SITE_FONT_WEIGHTS,
  SITE_SEO_INDEXING_MODES,
  SITE_TYPOGRAPHY_MODES,
} from "@/constants/site-design";

export type SiteAppearanceMode = (typeof SITE_APPEARANCE_MODES)[number];
export type SiteBackgroundDecoration =
  (typeof SITE_BACKGROUND_DECORATIONS)[number];
export type SiteCodeThemeMode = (typeof SITE_CODE_THEME_MODES)[number];
export type SiteFontWeight = (typeof SITE_FONT_WEIGHTS)[number];
export type SiteFontFormat = (typeof SITE_FONT_FORMATS)[number];
type SiteTypographyMode = (typeof SITE_TYPOGRAPHY_MODES)[number];
type SiteBannerType = (typeof SITE_BANNER_TYPES)[number];
type SiteSeoIndexing = (typeof SITE_SEO_INDEXING_MODES)[number];
export type SiteSocialPlatform = (typeof SITE_SOCIAL_PLATFORMS)[number];
export type SiteNavbarButton =
  | "none"
  | "button"
  | (typeof SITE_NAVBAR_LINK_TYPES)[number];

/** blog.json as written in the repository, before schema defaults. */
export type SiteRawConfig = Record<string, unknown>;

export interface SiteFontSpecForm {
  /** Empty keeps the theme default. Not in the preset list means custom. */
  family: string;
  /** Empty string keeps the theme default. */
  weight: string;
  /** Self-hosted file; empty loads the family from Google Fonts. */
  source: string;
  format: SiteFontFormat | "";
}

export interface SiteNavbarLinkForm {
  id: string;
  label: string;
  href: string;
}

export interface SiteMetaTagForm {
  id: string;
  name: string;
  content: string;
}

export interface SiteFooterSocialForm {
  id: string;
  platform: SiteSocialPlatform;
  /** Full profile URL; prefixed platforms edit only the handle after it. */
  url: string;
}

export interface SiteFooterLinkForm extends SiteNavbarLinkForm {
  /** Lucide icon from blog.json, kept but not editable here. */
  icon?: string;
}

export interface SiteFooterColumnForm {
  id: string;
  header: string;
  links: SiteFooterLinkForm[];
}

export interface SiteDesignForm {
  name: string;
  description: string;
  separateLogos: boolean;
  logoLight: string;
  logoDark: string;
  logoHref: string;
  separateFavicons: boolean;
  faviconLight: string;
  faviconDark: string;
  shareImage: string;
  shareImageAlt: string;
  primary: string;
  darkModeAccent: string;
  button: string;
  backgroundLight: string;
  backgroundDark: string;
  separateBackgroundImages: boolean;
  backgroundImageLight: string;
  backgroundImageDark: string;
  decoration: SiteBackgroundDecoration;
  appearance: SiteAppearanceMode;
  showModeToggle: boolean;
  codeMode: SiteCodeThemeMode;
  codeLight: string;
  codeDark: string;
  typographyMode: SiteTypographyMode;
  font: SiteFontSpecForm;
  heading: SiteFontSpecForm;
  body: SiteFontSpecForm;
  navbarButton: SiteNavbarButton;
  navbarButtonLabel: string;
  navbarButtonHref: string;
  navbarLinks: SiteNavbarLinkForm[];
  bannerEnabled: boolean;
  bannerContent: string;
  bannerDismissible: boolean;
  bannerType: SiteBannerType;
  bannerLight: string;
  bannerDark: string;
  metaTags: SiteMetaTagForm[];
  seoIndexing: SiteSeoIndexing;
  footerSocials: SiteFooterSocialForm[];
  footerColumnsEnabled: boolean;
  footerColumns: SiteFooterColumnForm[];
  /** Links blog.json lists without columns, restored when columns are switched off. */
  footerFlatLinks: SiteRawConfig[];
}

type SiteDesignFormUpdate<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface SiteColorInputProps {
  id: string;
  /** Accessible name of the hex field and the picker. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Color the field falls back to while empty, shown in the swatch. */
  fallback?: string;
}

export interface SiteFontRowsProps {
  id: string;
  label: string;
  hint: string;
  weightLabel: string;
  weightHint: string;
  /** Hide the weight until a family is picked; blog.json needs both. */
  weightNeedsFamily?: boolean;
  value: SiteFontSpecForm;
  onChange: (value: SiteFontSpecForm) => void;
}

export interface SiteSeparateAssetRowsProps {
  id: string;
  kind: SiteImageUploadKind;
  title: string;
  description: string;
  separateLabel: string;
  separate: boolean;
  onSeparateChange: (separate: boolean) => void;
  light: string;
  dark: string;
  onLightChange: (value: string) => void;
  onDarkChange: (value: string) => void;
  placeholder: string;
}

/** An image an asset field just uploaded, shown before its draft is fetched. */
export interface SiteImageUploadPreview {
  path: string;
  url: string;
}

export interface SiteAssetFieldProps {
  id: string;
  kind: SiteImageUploadKind;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export interface SiteBrandDefaults {
  primary?: string;
  logoLight?: string;
  logoDark?: string;
  headingFamily?: string;
  bodyFamily?: string;
}

export interface SiteBrandDefaultsState {
  brand: SiteBrandDefaults | null;
  /** The site's project has, or may still turn out to have, a brand identity. */
  available: boolean;
}

export interface SiteDesignFieldsProps<T> {
  form: T;
  update: SiteDesignFormUpdate<T>;
}

export interface SiteOptionSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  /** Preview of an option, shown beside the open list for the highlighted one; null hides it. */
  preview?: (value: T) => ReactNode;
  /** One-line explanation under the preview. */
  describe?: (value: T) => string;
}

type SiteBrandField = "primary" | "logoLight" | "logoDark" | "heading" | "body";

export interface SiteBrandChange {
  field: SiteBrandField;
  kind: "color" | "image" | "font";
  from: string;
  to: string;
}

export interface SiteBrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: SiteBrandChange[];
  onConfirm: () => void;
}

export interface SiteBrandValueProps {
  change: SiteBrandChange;
  value: string;
}

export interface SiteDesignPreviewColors {
  primary: string;
  backgroundLight: string;
  backgroundDark: string;
}

export interface SiteMiniPageProps {
  colors: SiteDesignPreviewColors;
  tone: SiteDesignPreviewTone;
  code?: SiteDesignPreviewTone | "accent";
  className?: string;
}

type SiteDesignPreviewTone = "light" | "dark";

export interface SiteSocialLinkMeta {
  label: string;
  /** Brand mark; without one the editor shows a globe or the site's favicon. */
  logo?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Profile URL the handle is appended to; without one the field takes a full URL. */
  prefix?: string;
  /** Handles on this platform keep their leading "@" in the URL. */
  keepsAt?: boolean;
}

export interface SiteFooterFieldsProps extends SiteDesignFieldsProps<SiteDesignForm> {
  /** Sets several fields at once, e.g. the columns switch with its first column. */
  patch: (patch: Partial<SiteDesignForm>) => void;
}

export interface SiteFooterSocialRowProps {
  social: SiteFooterSocialForm;
  onChange: (url: string) => void;
  onRemove: () => void;
}

export interface SiteFooterColumnFieldsProps {
  column: SiteFooterColumnForm;
  index: number;
  /** Where blog.json validation reports this column; blank columns aren't saved. */
  errorPath?: string;
  onChange: (column: SiteFooterColumnForm) => void;
  onRemove: () => void;
}
