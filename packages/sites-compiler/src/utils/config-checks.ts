import { SITE_ICON_NAMES } from "@notra/sites-core/constants/site-layout";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import { tagSlug } from "@notra/sites-core/utils/tags";

import type { SiteEntry } from "../types/entries";
import type { IconSetting } from "../types/validate";
import { closestName } from "./closest-name";
import { offsetToLineColumn } from "./paths";

export function unknownConfigKeyWarnings(raw: unknown): SiteDiagnostic[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const known = Object.keys(siteConfigSchema.shape);
  return Object.keys(raw)
    .filter((key) => !known.includes(key))
    .map((key) => {
      const suggestion = closestName(key, known);
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
      return {
        severity: "warning" as const,
        file: SITE_CONFIG_FILENAME,
        code: "config_unknown_key",
        message: `Unknown setting "${key}" is ignored.${hint}`,
      };
    });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function navbarPrimaryButtonWarnings(raw: unknown): SiteDiagnostic[] {
  const navbar = record(record(raw).navbar);
  if (record(navbar.primary).type !== "button") {
    return [];
  }
  return [
    {
      severity: "warning",
      file: SITE_CONFIG_FILENAME,
      code: "navbar_primary_button",
      message:
        navbar.cta === undefined
          ? 'navbar.primary with type "button" is used as navbar.cta. Rename it to "cta" and drop "type"; navbar.primary is for platform buttons like github.'
          : 'navbar.primary with type "button" is ignored because navbar.cta is set. Remove it; navbar.primary is for platform buttons like github.',
    },
  ];
}

function iconSettings(value: unknown, path: string[] = []): IconSetting[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      iconSettings(item, [...path, String(index)])
    );
  }
  return Object.entries(record(value)).flatMap(([key, child]) =>
    key === "icon" && typeof child === "string"
      ? [{ name: child, setting: [...path, key].join(".") }]
      : iconSettings(child, [...path, key])
  );
}

export function unknownIconWarnings(
  config: SiteConfig,
  source: string
): SiteDiagnostic[] {
  const known: readonly string[] = SITE_ICON_NAMES;
  const navbar = record(record(JSON.parse(source)).navbar);
  const aliased =
    record(navbar.primary).type === "button" && navbar.cta === undefined;
  const unknown = new Map<string, string[]>();
  for (const icon of iconSettings({ ...config, variables: undefined })) {
    if (!known.includes(icon.name)) {
      const setting =
        aliased && icon.setting === "navbar.cta.icon"
          ? "navbar.primary.icon"
          : icon.setting;
      unknown.set(icon.name, [...(unknown.get(icon.name) ?? []), setting]);
    }
  }
  return [...unknown].map(([name, settings]) => {
    const suggestion = closestName(name, known);
    const offset = source.search(new RegExp(`"icon"\\s*:\\s*"${name}"`));
    return {
      severity: "warning" as const,
      file: SITE_CONFIG_FILENAME,
      ...(offset === -1 ? {} : offsetToLineColumn(source, offset)),
      code: "icon_unknown",
      message: `Icon "${name}" (${settings.join(", ")}) is not bundled with Notra and is skipped.${suggestion ? ` Did you mean "${suggestion}"?` : ""} See the icon list in the blog.json reference.`,
    };
  });
}

export function featuredSlugWarnings(
  config: SiteConfig,
  entries: SiteEntry[]
): SiteDiagnostic[] {
  const featured = config.blog?.featured;
  if (!Array.isArray(featured)) {
    return [];
  }
  const slugs = new Set(
    entries.filter((entry) => entry.area === "blog").map((entry) => entry.slug)
  );
  return featured
    .filter((slug) => !slugs.has(slug))
    .map((slug) => ({
      severity: "warning" as const,
      file: SITE_CONFIG_FILENAME,
      code: "featured_unknown",
      message: `blog.featured: no post at blog/${slug}. It is skipped.`,
    }));
}

export function categoryWarnings(
  config: SiteConfig,
  blogTags: ReadonlySet<string>
): SiteDiagnostic[] {
  const categories = config.blog?.categories;
  if (!Array.isArray(categories)) {
    return [];
  }
  return categories
    .filter((name) => !blogTags.has(tagSlug(name)))
    .map((name) => ({
      severity: "warning" as const,
      file: SITE_CONFIG_FILENAME,
      code: "category_unknown",
      message: `blog.categories: no post is tagged "${name}". It is skipped.`,
    }));
}
