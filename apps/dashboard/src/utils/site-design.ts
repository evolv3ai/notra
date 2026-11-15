import {
  SITE_DEFAULT_APPEARANCE_STORAGE_KEY,
  SITE_DEFAULT_PRIMARY_COLOR,
  SITE_HEX_COLOR,
  SITE_META_TAG_NAME,
} from "@notra/sites-core/constants/site-config";
import {
  SITE_NAVBAR_LINK_TYPES,
  SITE_SOCIAL_PLATFORMS,
} from "@notra/sites-core/constants/site-layout";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import {
  SITE_APPEARANCE_MODES,
  SITE_BACKGROUND_DECORATIONS,
  SITE_BANNER_PRESET_COLORS,
  SITE_BANNER_TYPES,
  SITE_DEFAULT_CODE_DARK_THEME,
  SITE_DEFAULT_CODE_LIGHT_THEME,
  SITE_FONT_FORMATS,
  SITE_SEO_INDEXING_MODES,
  SITE_SOCIAL_LINKS,
} from "@/constants/site-design";
import type { BrandGuidelinesResponse } from "@/types/hooks/brand-guidelines";
import type {
  SiteAppearanceMode,
  SiteBackgroundDecoration,
  SiteBrandChange,
  SiteBrandDefaults,
  SiteDesignForm,
  SiteFontFormat,
  SiteFontSpecForm,
  SiteMetaTagForm,
  SiteFooterColumnForm,
  SiteFooterLinkForm,
  SiteFooterSocialForm,
  SiteNavbarButton,
  SiteNavbarLinkForm,
  SiteRawConfig,
  SiteSocialPlatform,
} from "@/types/site-design";

type SiteDesignKey = keyof SiteDesignForm;

const GENERAL_KEYS: readonly SiteDesignKey[] = ["name", "description"];
const LOGO_KEYS: readonly SiteDesignKey[] = [
  "separateLogos",
  "logoLight",
  "logoDark",
  "logoHref",
];
const FAVICON_KEYS: readonly SiteDesignKey[] = [
  "separateFavicons",
  "faviconLight",
  "faviconDark",
];
const SHARE_IMAGE_KEYS: readonly SiteDesignKey[] = [
  "shareImage",
  "shareImageAlt",
];
const COLOR_KEYS: readonly SiteDesignKey[] = [
  "primary",
  "darkModeAccent",
  "button",
];
const BACKGROUND_KEYS: readonly SiteDesignKey[] = [
  "backgroundLight",
  "backgroundDark",
  "separateBackgroundImages",
  "backgroundImageLight",
  "backgroundImageDark",
  "decoration",
];
const APPEARANCE_KEYS: readonly SiteDesignKey[] = [
  "appearance",
  "showModeToggle",
];
const CODE_KEYS: readonly SiteDesignKey[] = [
  "codeMode",
  "codeLight",
  "codeDark",
];
const FONT_KEYS: readonly SiteDesignKey[] = [
  "typographyMode",
  "font",
  "heading",
  "body",
];
const NAVBAR_BUTTON_KEYS: readonly SiteDesignKey[] = [
  "navbarButton",
  "navbarButtonLabel",
  "navbarButtonHref",
];
const NAVBAR_KEYS: readonly SiteDesignKey[] = [
  ...NAVBAR_BUTTON_KEYS,
  "navbarLinks",
];

const BANNER_KEYS: readonly SiteDesignKey[] = [
  "bannerEnabled",
  "bannerContent",
  "bannerDismissible",
  "bannerType",
  "bannerLight",
  "bannerDark",
];

const SEO_KEYS: readonly SiteDesignKey[] = ["metaTags", "seoIndexing"];
const FOOTER_SOCIAL_KEYS: readonly SiteDesignKey[] = ["footerSocials"];
const FOOTER_COLUMN_KEYS: readonly SiteDesignKey[] = [
  "footerColumnsEnabled",
  "footerColumns",
];

const EMPTY_FONT: SiteFontSpecForm = {
  family: "",
  weight: "",
  source: "",
  format: "",
};

function isRecord(value: unknown): value is SiteRawConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): SiteRawConfig {
  return isRecord(value) ? value : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function byMode(value: unknown): { light: string; dark: string } {
  if (typeof value === "string") {
    return { light: value, dark: value };
  }
  const modes = record(value);
  return { light: text(modes.light), dark: text(modes.dark) };
}

function hasSeparateModes(value: unknown): boolean {
  const modes = byMode(value);
  return modes.dark !== "" && modes.dark !== modes.light;
}

/** One path for both modes, or `{ light, dark }` when they differ. */
function writeByMode(
  separate: boolean,
  light: string,
  dark: string,
  extra: SiteRawConfig = {}
): string | SiteRawConfig | undefined {
  const lightValue = light.trim() || (separate ? dark.trim() : "");
  const darkValue = separate ? dark.trim() || lightValue : lightValue;
  if (!lightValue) {
    return undefined;
  }
  if (lightValue === darkValue && Object.keys(extra).length === 0) {
    return lightValue;
  }
  return { light: lightValue, dark: darkValue, ...extra };
}

function assign(config: SiteRawConfig, key: string, value: unknown) {
  if (value === undefined) {
    delete config[key];
  } else {
    config[key] = value;
  }
}

function assignObject(
  config: SiteRawConfig,
  key: string,
  value: SiteRawConfig
) {
  assign(config, key, Object.keys(value).length > 0 ? value : undefined);
}

function hex(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : undefined;
}

function changed(
  form: SiteDesignForm,
  initial: SiteDesignForm,
  keys: readonly SiteDesignKey[]
): boolean {
  return keys.some(
    (key) => JSON.stringify(form[key]) !== JSON.stringify(initial[key])
  );
}

export function parseSiteConfig(content: string): SiteRawConfig {
  const parsed: unknown = JSON.parse(content);
  if (!isRecord(parsed)) {
    throw new Error("blog.json must contain an object");
  }
  return parsed;
}

export function serializeSiteConfig(config: SiteRawConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** Path of the first value the schema rejects, or null when valid. */
export function siteConfigIssue(config: SiteRawConfig): string | null {
  const result = siteConfigSchema.safeParse(config);
  if (result.success) {
    return null;
  }
  return result.error.issues[0]?.path.join(".") || "blog.json";
}

function readFontSpec(spec: unknown): SiteFontSpecForm {
  const font = record(spec);
  return {
    family: text(font.family),
    weight: typeof font.weight === "number" ? String(font.weight) : "",
    source: text(font.source),
    format: SITE_FONT_FORMATS.includes(font.format as SiteFontFormat)
      ? (font.format as SiteFontFormat)
      : "",
  };
}

/** Format of a self-hosted font, taken from the file name when not chosen. */
function fontFormat(font: SiteFontSpecForm): SiteFontFormat {
  if (font.format) {
    return font.format;
  }
  return /\.woff(?:[?#]|$)/i.test(font.source) ? "woff" : "woff2";
}

function writeFontSpec(font: SiteFontSpecForm): SiteRawConfig | undefined {
  const family = font.family.trim();
  if (!family) {
    return undefined;
  }
  const spec: SiteRawConfig = { family };
  assign(spec, "weight", font.weight ? Number(font.weight) : undefined);
  const source = font.source.trim();
  if (source) {
    spec.source = source;
    spec.format = fontFormat(font);
  }
  return spec;
}

function readNavbarButton(navbar: SiteRawConfig): {
  button: SiteNavbarButton;
  label: string;
  href: string;
} {
  const primary = record(navbar.primary);
  const cta = record(navbar.cta);
  const type = SITE_NAVBAR_LINK_TYPES.find((item) => item === primary.type);
  if (type) {
    return { button: type, label: "", href: text(primary.href) };
  }
  const button = !text(cta.label) && primary.type === "button" ? primary : cta;
  if (text(button.label)) {
    return {
      button: "button",
      label: text(button.label),
      href: text(button.href),
    };
  }
  return { button: "none", label: "", href: "" };
}

/** Plain label + link entries; dropdowns and platform links stay in blog.json. */
function isPlainNavbarLink(entry: unknown): boolean {
  const link = record(entry);
  return (
    typeof link.label === "string" &&
    typeof link.href === "string" &&
    link.type === undefined &&
    link.items === undefined
  );
}

function isFooterColumn(entry: unknown): boolean {
  return Array.isArray(record(entry).items);
}

function readFooterSocials(footer: SiteRawConfig): SiteFooterSocialForm[] {
  return Object.entries(record(footer.socials)).flatMap(([key, url]) => {
    const platform = SITE_SOCIAL_PLATFORMS.find((item) => item === key);
    return platform && typeof url === "string"
      ? [{ id: `social-${platform}`, platform, url }]
      : [];
  });
}

function readFooterLink(entry: unknown, id: string): SiteFooterLinkForm {
  const link = record(entry);
  const icon = text(link.icon);
  return {
    id,
    label: text(link.label),
    href: text(link.href),
    ...(icon ? { icon } : {}),
  };
}

function readFooterColumns(footer: SiteRawConfig): SiteFooterColumnForm[] {
  const links = Array.isArray(footer.links) ? footer.links : [];
  return links.filter(isFooterColumn).map((entry, index) => {
    const column = record(entry);
    const items = column.items as unknown[];
    return {
      id: `column-${index}`,
      header: text(column.header),
      links: items.map((item, itemIndex) =>
        readFooterLink(item, `link-${itemIndex}`)
      ),
    };
  });
}

function readCodeMode(codeblocks: unknown): SiteDesignForm["codeMode"] {
  if (codeblocks === undefined || codeblocks === "system") {
    return "system";
  }
  return codeblocks === "dark" ? "dark" : "custom";
}

export function readDesignForm(config: SiteRawConfig): SiteDesignForm {
  const logo = byMode(config.logo);
  const favicon = byMode(config.favicon);
  const seo = record(config.seo);
  const colors = record(config.colors);
  const appearance = config.appearance;
  const appearanceRecord = record(appearance);
  const appearanceMode =
    typeof appearance === "string" ? appearance : appearanceRecord.default;
  const background = record(config.background);
  const backgroundColor = record(background.color);
  const backgroundImage = byMode(background.image);
  const fonts = record(config.fonts);
  const pair = Boolean(
    text(record(fonts.heading).family) || text(record(fonts.body).family)
  );
  const codeblocks = record(config.styling).codeblocks;
  const codeModes = byMode(codeblocks);
  const codeMode = readCodeMode(codeblocks);
  const navbar = record(config.navbar);
  const navbarButton = readNavbarButton(navbar);
  const links = Array.isArray(navbar.links) ? navbar.links : [];
  const banner = record(config.banner);
  const bannerColor = byMode(banner.color);
  const footer = record(config.footer);
  const footerColumns = readFooterColumns(footer);
  return {
    name: text(config.name),
    description: text(config.description),
    separateLogos: hasSeparateModes(config.logo),
    logoLight: logo.light,
    logoDark: hasSeparateModes(config.logo) ? logo.dark : "",
    logoHref: text(record(config.logo).href),
    separateFavicons: hasSeparateModes(config.favicon),
    faviconLight: favicon.light,
    faviconDark: hasSeparateModes(config.favicon) ? favicon.dark : "",
    shareImage: text(seo.image),
    shareImageAlt: text(seo.imageAlt),
    primary: text(colors.primary) || SITE_DEFAULT_PRIMARY_COLOR,
    darkModeAccent: text(colors.light),
    button: text(colors.dark),
    backgroundLight: text(backgroundColor.light),
    backgroundDark: text(backgroundColor.dark),
    separateBackgroundImages: hasSeparateModes(background.image),
    backgroundImageLight: backgroundImage.light,
    backgroundImageDark: hasSeparateModes(background.image)
      ? backgroundImage.dark
      : "",
    decoration:
      SITE_BACKGROUND_DECORATIONS.find(
        (item) => item === background.decoration
      ) ?? ("none" satisfies SiteBackgroundDecoration),
    appearance:
      SITE_APPEARANCE_MODES.find((item) => item === appearanceMode) ??
      ("system" satisfies SiteAppearanceMode),
    showModeToggle: appearanceRecord.strict !== true,
    codeMode,
    codeLight:
      codeMode === "custom" ? codeModes.light : SITE_DEFAULT_CODE_LIGHT_THEME,
    codeDark:
      codeMode === "custom" ? codeModes.dark : SITE_DEFAULT_CODE_DARK_THEME,
    typographyMode: pair ? "pair" : "single",
    font: pair ? EMPTY_FONT : readFontSpec(fonts),
    heading: readFontSpec(fonts.heading),
    body: pair
      ? readFontSpec(text(record(fonts.body).family) ? fonts.body : fonts)
      : EMPTY_FONT,
    navbarButton: navbarButton.button,
    navbarButtonLabel: navbarButton.label,
    navbarButtonHref: navbarButton.href,
    navbarLinks: links.filter(isPlainNavbarLink).map((entry, index) => {
      const link = record(entry);
      return {
        id: `link-${index}`,
        label: text(link.label),
        href: text(link.href),
      };
    }),
    bannerEnabled: text(banner.content) !== "",
    bannerContent: text(banner.content),
    bannerDismissible: banner.dismissible === true,
    bannerType:
      SITE_BANNER_TYPES.find((item) => item === banner.type) ?? "info",
    bannerLight: bannerColor.light,
    bannerDark: hasSeparateModes(banner.color) ? bannerColor.dark : "",
    metaTags: Object.entries(record(seo.metatags)).map(
      ([name, content], index) => ({
        id: `tag-${index}`,
        name,
        content: text(content),
      })
    ),
    seoIndexing:
      SITE_SEO_INDEXING_MODES.find((item) => item === seo.indexing) ??
      "navigable",
    footerSocials: readFooterSocials(footer),
    footerColumnsEnabled: footerColumns.length > 0,
    footerColumns,
    footerFlatLinks: (Array.isArray(footer.links) ? footer.links : []).filter(
      (entry): entry is SiteRawConfig =>
        isRecord(entry) && !isFooterColumn(entry)
    ),
  };
}

function patchAppearance(config: SiteRawConfig, form: SiteDesignForm) {
  const previous = record(config.appearance);
  const storageKey = text(previous.storageKey);
  const keepsStorageKey =
    storageKey !== "" && storageKey !== SITE_DEFAULT_APPEARANCE_STORAGE_KEY;
  if (!form.showModeToggle || keepsStorageKey) {
    const appearance: SiteRawConfig = {
      default: form.appearance,
      strict: !form.showModeToggle,
    };
    if (keepsStorageKey) {
      appearance.storageKey = storageKey;
    }
    config.appearance = appearance;
  } else if (form.appearance === "system") {
    delete config.appearance;
  } else {
    config.appearance = form.appearance;
  }
}

/** The alt text only describes an image, so it goes when the image does. */
function patchShareImage(config: SiteRawConfig, form: SiteDesignForm) {
  const seo: SiteRawConfig = { ...record(config.seo) };
  const image = form.shareImage.trim();
  assign(seo, "image", image || undefined);
  assign(seo, "imageAlt", (image && form.shareImageAlt.trim()) || undefined);
  assignObject(config, "seo", seo);
}

/** Lowercased names that more than one meta tag row uses. */
export function duplicateMetaTagNames(
  tags: readonly SiteMetaTagForm[]
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const tag of tags) {
    const name = tag.name.trim().toLowerCase();
    if (name && seen.has(name)) {
      duplicates.add(name);
    }
    seen.add(name);
  }
  return duplicates;
}

/** Rows blog.json would reject: a name the schema refuses, or a value without a name. */
export function invalidMetaTagIds(
  tags: readonly SiteMetaTagForm[]
): Set<string> {
  return new Set(
    tags
      .filter((tag) => {
        const name = tag.name.trim();
        return (
          (name || tag.content.trim()) !== "" && !SITE_META_TAG_NAME.test(name)
        );
      })
      .map((tag) => tag.id)
  );
}

/** Empty rows are dropped; a value without a name stays so the schema flags it. */
function metaTagRecord(tags: readonly SiteMetaTagForm[]): SiteRawConfig {
  const metatags: SiteRawConfig = {};
  for (const tag of tags) {
    const name = tag.name.trim();
    const content = tag.content.trim();
    if (name || content) {
      metatags[name] = content;
    }
  }
  return metatags;
}

/** Rows sharing a name would overwrite each other, so they leave the saved tags alone. */
function patchSeo(
  config: SiteRawConfig,
  form: SiteDesignForm,
  initial: SiteDesignForm
) {
  const seo: SiteRawConfig = { ...record(config.seo) };
  if (
    changed(form, initial, ["metaTags"]) &&
    duplicateMetaTagNames(form.metaTags).size === 0
  ) {
    const metatags = metaTagRecord(form.metaTags);
    assign(
      seo,
      "metatags",
      Object.keys(metatags).length > 0 ? metatags : undefined
    );
  }
  if (changed(form, initial, ["seoIndexing"])) {
    assign(
      seo,
      "indexing",
      form.seoIndexing === "navigable" ? undefined : form.seoIndexing
    );
  }
  assignObject(config, "seo", seo);
}

function patchBackground(config: SiteRawConfig, form: SiteDesignForm) {
  const background: SiteRawConfig = { ...record(config.background) };
  assign(
    background,
    "decoration",
    form.decoration === "none" ? undefined : form.decoration
  );
  const color: SiteRawConfig = {};
  assign(color, "light", hex(form.backgroundLight));
  assign(color, "dark", hex(form.backgroundDark));
  assignObject(background, "color", color);
  assign(
    background,
    "image",
    writeByMode(
      form.separateBackgroundImages,
      form.backgroundImageLight,
      form.backgroundImageDark
    )
  );
  assignObject(config, "background", background);
}

function patchFonts(
  config: SiteRawConfig,
  form: SiteDesignForm,
  initial: SiteDesignForm
) {
  if (form.typographyMode === "single") {
    // A weight alone restyles the theme's default family.
    const weightOnly = form.font.weight
      ? { weight: Number(form.font.weight) }
      : undefined;
    assign(config, "fonts", writeFontSpec(form.font) ?? weightOnly);
    return;
  }
  const fonts: SiteRawConfig = { ...record(config.fonts) };
  for (const role of ["heading", "body"] as const) {
    if (
      form.typographyMode !== initial.typographyMode ||
      changed(form, initial, [role])
    ) {
      assign(fonts, role, writeFontSpec(form[role]));
    }
  }
  assignObject(config, "fonts", fonts);
}

function patchCodeblocks(config: SiteRawConfig, form: SiteDesignForm) {
  const styling: SiteRawConfig = { ...record(config.styling) };
  if (form.codeMode === "system") {
    delete styling.codeblocks;
  } else if (form.codeMode === "dark") {
    styling.codeblocks = "dark";
  } else {
    styling.codeblocks = writeByMode(true, form.codeLight, form.codeDark);
  }
  assignObject(config, "styling", styling);
}

function patchNavbar(
  config: SiteRawConfig,
  form: SiteDesignForm,
  initial: SiteDesignForm
) {
  const navbar: SiteRawConfig = { ...record(config.navbar) };
  if (changed(form, initial, NAVBAR_BUTTON_KEYS)) {
    const { type: _type, ...primaryButton } = record(navbar.primary);
    const previousCta =
      navbar.cta === undefined && _type === "button"
        ? primaryButton
        : record(navbar.cta);
    if (initial.navbarButton === "button") {
      delete navbar.cta;
      if (record(navbar.primary).type === "button") {
        delete navbar.primary;
      }
    } else if (initial.navbarButton !== "none") {
      delete navbar.primary;
    }
    if (form.navbarButton === "button") {
      navbar.cta = {
        ...previousCta,
        label: form.navbarButtonLabel.trim(),
        href: form.navbarButtonHref.trim(),
      };
    } else if (form.navbarButton !== "none") {
      navbar.primary = {
        type: form.navbarButton,
        href: form.navbarButtonHref.trim(),
      };
    }
  }
  config.navbar = navbar;
  if (!changed(form, initial, ["navbarLinks"])) {
    return;
  }
  const previous = Array.isArray(navbar.links) ? navbar.links : [];
  const plainPrevious = previous.filter(isPlainNavbarLink);
  const edited = new Map(
    form.navbarLinks
      .filter((link) => link.label.trim() || link.href.trim())
      .map((link) => {
        // Read ids are "link-<index>" into the plain links; keep their icons.
        const index = Number(link.id.replace(/^link-/, ""));
        const icon = record(
          link.id.startsWith("link-") ? plainPrevious[index] : undefined
        ).icon;
        const next: SiteRawConfig = {
          label: link.label.trim(),
          href: link.href.trim(),
        };
        assign(next, "icon", typeof icon === "string" ? icon : undefined);
        return [link.id, next] as const;
      })
  );
  // Match retained links to their original slots; deleted links leave no slot.
  const links: unknown[] = [];
  let plainIndex = 0;
  for (const entry of previous) {
    if (!isPlainNavbarLink(entry)) {
      links.push(entry);
      continue;
    }
    const id = `link-${plainIndex}`;
    plainIndex += 1;
    const link = edited.get(id);
    if (link) {
      links.push(link);
      edited.delete(id);
    }
  }
  navbar.links = [...links, ...edited.values()];
}

/** Colors the site uses for the banner type when no custom color is set. */
export function bannerPresetColors(form: SiteDesignForm): {
  light: string;
  dark: string;
} {
  if (form.bannerType !== "info") {
    return SITE_BANNER_PRESET_COLORS[form.bannerType];
  }
  const brand = form.button || form.primary;
  return { light: brand, dark: brand };
}

/** A dark color alone keeps the type's light color instead of applying to both modes. */
function bannerColor(form: SiteDesignForm): string | SiteRawConfig | undefined {
  const light = hex(form.bannerLight);
  const dark = hex(form.bannerDark);
  if (!light && dark) {
    return { light: hex(bannerPresetColors(form).light), dark };
  }
  return writeByMode(true, light ?? "", dark ?? "");
}

/** blog.json has no off switch: a banner without content is no banner. */
function patchBanner(config: SiteRawConfig, form: SiteDesignForm) {
  const content = form.bannerContent.trim();
  if (!form.bannerEnabled || !content) {
    delete config.banner;
    return;
  }
  const banner: SiteRawConfig = { ...record(config.banner), content };
  assign(banner, "dismissible", form.bannerDismissible || undefined);
  assign(
    banner,
    "type",
    form.bannerType === "info" ? undefined : form.bannerType
  );
  assign(banner, "color", bannerColor(form));
  config.banner = banner;
}

function writeFooterLink(link: SiteFooterLinkForm): SiteRawConfig | null {
  const label = link.label.trim();
  const href = link.href.trim();
  if (!(label || href)) {
    return null;
  }
  const next: SiteRawConfig = { label, href };
  assign(next, "icon", link.icon);
  return next;
}

function writeFooterSocials(socials: SiteFooterSocialForm[]): SiteRawConfig {
  const written: SiteRawConfig = {};
  for (const social of socials) {
    assign(written, social.platform, social.url.trim() || undefined);
  }
  return written;
}

/** A column with nothing typed in, which isn't saved. */
export function isBlankFooterColumn(column: SiteFooterColumnForm): boolean {
  return (
    !column.header.trim() &&
    column.links.every((link) => !(link.label.trim() || link.href.trim()))
  );
}

/** Blank columns are dropped; half-filled ones fail validation. */
function writeFooterColumns(columns: SiteFooterColumnForm[]): SiteRawConfig[] {
  return columns.flatMap((column) => {
    if (isBlankFooterColumn(column)) {
      return [];
    }
    const items = column.links.flatMap((link) => {
      const next = writeFooterLink(link);
      return next ? [next] : [];
    });
    const next: SiteRawConfig = { items };
    assign(next, "header", column.header.trim() || undefined);
    return [next];
  });
}

function patchFooter(
  config: SiteRawConfig,
  form: SiteDesignForm,
  initial: SiteDesignForm
) {
  const footer: SiteRawConfig = { ...record(config.footer) };
  if (changed(form, initial, FOOTER_SOCIAL_KEYS)) {
    assignObject(footer, "socials", writeFooterSocials(form.footerSocials));
  }
  if (changed(form, initial, FOOTER_COLUMN_KEYS)) {
    const columns = form.footerColumnsEnabled
      ? writeFooterColumns(form.footerColumns)
      : [];
    // blog.json holds either columns or flat links; the form remembers the
    // flat ones, so switching columns off brings them back.
    const links = columns.length > 0 ? columns : form.footerFlatLinks;
    assign(footer, "links", links.length > 0 ? links : undefined);
  }
  assignObject(config, "footer", footer);
}

/** Writes only the sections the form changed, so untouched JSON stays as is. */
export function patchDesign(
  source: SiteRawConfig,
  form: SiteDesignForm,
  initial: SiteDesignForm
): SiteRawConfig {
  const config = structuredClone(source);
  if (changed(form, initial, GENERAL_KEYS)) {
    config.name = form.name.trim();
    assign(config, "description", form.description.trim() || undefined);
  }
  if (changed(form, initial, LOGO_KEYS)) {
    const href = form.logoHref.trim();
    assign(
      config,
      "logo",
      writeByMode(
        form.separateLogos,
        form.logoLight,
        form.logoDark,
        href ? { href } : {}
      )
    );
  }
  if (changed(form, initial, FAVICON_KEYS)) {
    assign(
      config,
      "favicon",
      writeByMode(form.separateFavicons, form.faviconLight, form.faviconDark)
    );
  }
  if (changed(form, initial, SHARE_IMAGE_KEYS)) {
    patchShareImage(config, form);
  }
  if (changed(form, initial, COLOR_KEYS)) {
    const colors: SiteRawConfig = {
      primary: hex(form.primary) ?? SITE_DEFAULT_PRIMARY_COLOR,
    };
    assign(colors, "light", hex(form.darkModeAccent));
    assign(colors, "dark", hex(form.button));
    config.colors = colors;
  }
  if (changed(form, initial, BACKGROUND_KEYS)) {
    patchBackground(config, form);
  }
  if (changed(form, initial, APPEARANCE_KEYS)) {
    patchAppearance(config, form);
  }
  if (changed(form, initial, CODE_KEYS)) {
    patchCodeblocks(config, form);
  }
  if (changed(form, initial, FONT_KEYS)) {
    patchFonts(config, form, initial);
  }
  if (changed(form, initial, NAVBAR_KEYS)) {
    patchNavbar(config, form, initial);
  }
  if (changed(form, initial, BANNER_KEYS)) {
    patchBanner(config, form);
  }
  if (changed(form, initial, SEO_KEYS)) {
    patchSeo(config, form, initial);
  }
  if (changed(form, initial, [...FOOTER_SOCIAL_KEYS, ...FOOTER_COLUMN_KEYS])) {
    patchFooter(config, form, initial);
  }
  return config;
}

export function newNavbarLink(): SiteNavbarLinkForm {
  return { id: crypto.randomUUID(), label: "", href: "" };
}

export function newMetaTag(): SiteMetaTagForm {
  return { id: crypto.randomUUID(), name: "", content: "" };
}

/**
 * Keeps the rows being edited when the document read back holds the tags
 * last written from them, so row ids (and focus), unfinished rows and rows
 * sharing a name (which aren't written) survive autosave. Tags changed
 * elsewhere replace the rows.
 */
export function keepMetaTagRows(
  next: SiteDesignForm,
  current: SiteDesignForm,
  read: SiteRawConfig,
  written: SiteRawConfig
): SiteDesignForm {
  const tags = (config: SiteRawConfig) =>
    JSON.stringify(record(config.seo).metatags ?? null);
  return tags(read) === tags(written)
    ? { ...next, metaTags: current.metaTags }
    : next;
}

export function newFooterLink(): SiteFooterLinkForm {
  return { id: crypto.randomUUID(), label: "", href: "" };
}

/** The first column starts with the footer's flat links, so turning columns on loses none. */
export function newFooterColumn(
  flatLinks: SiteRawConfig[] = []
): SiteFooterColumnForm {
  const links = flatLinks.map((link) =>
    readFooterLink(link, crypto.randomUUID())
  );
  return {
    id: crypto.randomUUID(),
    header: "",
    links: links.length > 0 ? links : [newFooterLink()],
  };
}

/**
 * After a save the form is read back from blog.json, which drops blank rows,
 * renumbers row ids and loses the flat-link backup. When the saved footer is
 * exactly what the form wrote, keep the form's rows instead.
 */
export function keepUnsavedFooterRows(
  next: SiteDesignForm,
  form: SiteDesignForm
): SiteDesignForm {
  const sameSocials =
    JSON.stringify(writeFooterSocials(next.footerSocials)) ===
    JSON.stringify(writeFooterSocials(form.footerSocials));
  const sameColumns = form.footerColumnsEnabled
    ? JSON.stringify(writeFooterColumns(next.footerColumns)) ===
      JSON.stringify(writeFooterColumns(form.footerColumns))
    : !next.footerColumnsEnabled;
  return {
    ...next,
    ...(sameSocials ? { footerSocials: form.footerSocials } : {}),
    ...(sameColumns
      ? {
          footerColumnsEnabled: form.footerColumnsEnabled,
          footerColumns: form.footerColumns,
          footerFlatLinks: next.footerColumnsEnabled
            ? form.footerFlatLinks
            : next.footerFlatLinks,
        }
      : {}),
  };
}

/**
 * The form after a save is read back from blog.json (`read`), keeping what
 * blog.json can't hold yet: unsaved footer and meta tag rows, and the
 * settings of a banner whose text is still empty.
 */
export function readBackDesignForm(
  read: SiteRawConfig,
  form: SiteDesignForm,
  written: SiteRawConfig
): SiteDesignForm {
  const next = keepMetaTagRows(
    keepUnsavedFooterRows(readDesignForm(read), form),
    form,
    read,
    written
  );
  // An empty banner isn't saved, so keep its settings while the text is empty.
  if (!form.bannerEnabled || form.bannerContent.trim()) {
    return next;
  }
  return {
    ...next,
    bannerEnabled: true,
    bannerDismissible: form.bannerDismissible,
    bannerType: form.bannerType,
    bannerLight: form.bannerLight,
    bannerDark: form.bannerDark,
  };
}

export function newFooterSocial(
  platform: SiteSocialPlatform
): SiteFooterSocialForm {
  return { id: crypto.randomUUID(), platform, url: "" };
}

/** What the social field shows: the handle after the platform's prefix, else the URL. */
export function socialHandle(social: SiteFooterSocialForm): {
  prefix: string | null;
  value: string;
} {
  const { prefix } = SITE_SOCIAL_LINKS[social.platform];
  if (!prefix) {
    return { prefix: null, value: social.url };
  }
  if (!social.url) {
    return { prefix, value: "" };
  }
  return social.url.startsWith(prefix)
    ? { prefix, value: social.url.slice(prefix.length) }
    : { prefix: null, value: social.url };
}

/** URL for what was typed: pasted URLs stay as they are, handles get the prefix. */
export function socialUrl(platform: SiteSocialPlatform, input: string): string {
  const { prefix, keepsAt } = SITE_SOCIAL_LINKS[platform];
  const value = input.trim();
  if (!(prefix && value) || /^https?:\/\//i.test(value)) {
    return value;
  }
  // "github.com/acme" is a URL without its scheme, not a handle.
  if (/^[^/\s]+\.[^/\s]+\//.test(value)) {
    return `https://${value}`;
  }
  return `${prefix}${keepsAt ? value : value.replace(/^@/, "")}`;
}

/** URL of a logo or favicon path as the live site serves it. */
export function siteAssetUrl(liveUrl: string, path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//.test(trimmed)) {
    return trimmed;
  }
  try {
    const base = liveUrl.endsWith("/") ? liveUrl : `${liveUrl}/`;
    return new URL(trimmed.replace(/^\//, ""), base).toString();
  } catch {
    return null;
  }
}

export function brandDefaultsFromGuidelines(
  guidelines: BrandGuidelinesResponse
): SiteBrandDefaults | null {
  const primary = guidelines.colors.find((item) => item.role === "primary");
  const logos = guidelines.assets.filter((asset) => asset.kind === "logo");
  const logo = (variant: "light" | "dark") =>
    logos.find((asset) => asset.variant === variant)?.url;
  const font = (role: "heading" | "body") =>
    guidelines.fonts.find((item) => item.role === role)?.family;
  const defaults: SiteBrandDefaults = {
    primary:
      primary && SITE_HEX_COLOR.test(primary.lightValue)
        ? primary.lightValue.toUpperCase()
        : undefined,
    logoLight: logo("light") ?? logo("dark"),
    logoDark: logo("dark"),
    headingFamily: font("heading"),
    bodyFamily: font("body"),
  };
  return Object.values(defaults).some(Boolean) ? defaults : null;
}

function brandFont(
  family: string | undefined,
  current: SiteFontSpecForm
): SiteFontSpecForm {
  return family ? { ...EMPTY_FONT, family, weight: current.weight } : current;
}

export function applyBrandToDesign(
  brand: SiteBrandDefaults,
  form: SiteDesignForm
): SiteDesignForm {
  const logoDark =
    brand.logoDark && brand.logoDark !== brand.logoLight ? brand.logoDark : "";
  const hasFonts = Boolean(brand.headingFamily || brand.bodyFamily);
  const heading = form.typographyMode === "pair" ? form.heading : EMPTY_FONT;
  const body = form.typographyMode === "pair" ? form.body : form.font;
  const next: SiteDesignForm = {
    ...form,
    primary: brand.primary ?? form.primary,
    logoLight: brand.logoLight ?? form.logoLight,
    logoDark: logoDark || form.logoDark,
    separateLogos: logoDark ? true : form.separateLogos,
  };
  if (!hasFonts) {
    return next;
  }
  return {
    ...next,
    typographyMode: "pair",
    heading: brandFont(brand.headingFamily, heading),
    body: brandFont(brand.bodyFamily, body),
  };
}

function fontFamily(form: SiteDesignForm, role: "heading" | "body"): string {
  if (form.typographyMode === "single") {
    return role === "body" ? form.font.family : "";
  }
  return form[role].family;
}

export function describeBrandForDesign(
  brand: SiteBrandDefaults,
  form: SiteDesignForm
): SiteBrandChange[] {
  const next = applyBrandToDesign(brand, form);
  const changes: SiteBrandChange[] = [
    { field: "primary", kind: "color", from: form.primary, to: next.primary },
    {
      field: "logoLight",
      kind: "image",
      from: form.logoLight,
      to: next.logoLight,
    },
    {
      field: "logoDark",
      kind: "image",
      from: form.logoDark,
      to: next.logoDark,
    },
    {
      field: "heading",
      kind: "font",
      from: fontFamily(form, "heading"),
      to: fontFamily(next, "heading"),
    },
    {
      field: "body",
      kind: "font",
      from: fontFamily(form, "body"),
      to: fontFamily(next, "body"),
    },
  ];
  return changes.filter((change) => change.from !== change.to);
}
