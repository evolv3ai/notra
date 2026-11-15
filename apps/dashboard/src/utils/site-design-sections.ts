import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import type { SiteRawConfig } from "@/types/site-design";
import type { SiteDesignIssue } from "@/types/site-design-sections";
import { parseSiteConfig } from "@/utils/site-design";

export function parseDesignSource(source: string): SiteRawConfig {
  try {
    return parseSiteConfig(source);
  } catch {
    return {};
  }
}
export function validDesignSource(source: string): boolean {
  try {
    parseSiteConfig(source);
    return true;
  } catch {
    return false;
  }
}
export function designIssues(config: SiteRawConfig): SiteDesignIssue[] {
  const result = siteConfigSchema.safeParse(config);
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
}
/**
 * Drop the values the schema rejects so their defaults apply, keeping the rest of the config.
 * Returns null when the config cannot be made valid this way.
 */
export function repairSiteConfig(
  config: SiteRawConfig,
  name: string
): SiteRawConfig | null {
  const next = structuredClone(config);
  const at = (keys: string[]) =>
    keys.reduce<unknown>(
      (value, key) =>
        typeof value === "object" && value !== null
          ? (value as SiteRawConfig)[key]
          : undefined,
      next
    );
  for (;;) {
    const result = siteConfigSchema.safeParse(next);
    if (result.success) {
      return next;
    }
    const issue = result.error.issues[0]!;
    const keys = issue.path.map(String);
    const target = at(keys);
    if (issue.code === "unrecognized_keys" && typeof target === "object") {
      for (const key of issue.keys) {
        delete (target as SiteRawConfig)[key];
      }
      continue;
    }
    if (
      issue.code === "too_big" &&
      issue.origin === "array" &&
      Array.isArray(target)
    ) {
      target.length = Number(issue.maximum);
      continue;
    }
    if (keys.length === 0 || (keys.length === 1 && keys[0] === "name")) {
      const fallback = name.trim().slice(0, 80) || "Site";
      if (next.name === fallback) {
        return null;
      }
      next.name = fallback;
      continue;
    }
    while (keys.length > 0) {
      const key = keys.at(-1)!;
      const holder = at(keys.slice(0, -1));
      if (Array.isArray(holder) && Number(key) < holder.length) {
        holder.splice(Number(key), 1);
        break;
      }
      if (
        typeof holder === "object" &&
        holder !== null &&
        Object.hasOwn(holder, key)
      ) {
        if (keys.length === 2 && keys[0] === "integrations" && key === "c15t") {
          delete next.integrations;
        } else {
          delete (holder as SiteRawConfig)[key];
        }
        break;
      }
      keys.pop();
    }
    if (keys.length === 0) {
      return null;
    }
  }
}
export function configValue(config: unknown, path: string): unknown {
  let value = config;
  for (const key of path.split(".")) {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    value = (value as SiteRawConfig)[key];
  }
  return value;
}
/** Patch a single field without normalizing or dropping untouched configuration. */
export function patchConfigValue(
  config: SiteRawConfig,
  path: string,
  value: unknown
): SiteRawConfig {
  const next = structuredClone(config);
  if (value === "" && path === "banner.content") {
    delete next.banner;
    return next;
  }
  if (
    value === "" &&
    [
      "integrations.ga4.measurementId",
      "integrations.plausible.domain",
      "integrations.posthog.apiKey",
      "integrations.umami.websiteId",
    ].includes(path)
  ) {
    return patchConfigValue(
      config,
      path.split(".").slice(0, -1).join("."),
      undefined
    );
  }
  const keys = path.split(".");
  let target = next;
  for (const key of keys.slice(0, -1)) {
    const current = target[key];
    target[key] =
      typeof current === "object" && current !== null ? current : {};
    target = target[key] as SiteRawConfig;
  }
  const key = keys.at(-1)!;
  if (value === "" || value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
  // Empty optional groups mean "use defaults" or "disabled".
  for (let depth = keys.length - 1; depth > 0; depth--) {
    const parent = configValue(next, keys.slice(0, depth - 1).join(".")) as
      | SiteRawConfig
      | undefined;
    const holder = depth === 1 ? next : parent;
    const childKey = keys[depth - 1]!;
    const child = holder?.[childKey];
    if (
      child &&
      typeof child === "object" &&
      !Array.isArray(child) &&
      Object.keys(child).length === 0
    ) {
      delete holder![childKey];
    }
  }
  return next;
}
export function configSectionChanged(
  config: SiteRawConfig,
  published: SiteRawConfig,
  paths: readonly string[]
): boolean {
  return paths.some(
    (path) =>
      JSON.stringify(configValue(config, path)) !==
      JSON.stringify(configValue(published, path))
  );
}
