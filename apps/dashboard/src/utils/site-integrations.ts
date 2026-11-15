import {
  siteIntegrationSchemas,
  siteIntegrationUpdateSchema,
} from "@notra/sites-core/schemas/site-integrations";

import type {
  SiteIntegrationProvider,
  SiteIntegrationValues,
} from "@/types/site-integrations";

export function siteIntegrationSettings(
  integrations: Record<string, unknown> | undefined,
  provider: SiteIntegrationProvider
): Record<string, unknown> | null {
  const value = integrations?.[provider.id];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function siteIntegrationFormValues(
  provider: SiteIntegrationProvider,
  settings: Record<string, unknown> | null
): SiteIntegrationValues {
  const values: SiteIntegrationValues = {};
  for (const field of provider.fields) {
    const value = settings?.[field.key];
    if (field.type === "boolean") {
      values[field.key] =
        typeof value === "boolean" ? value : (field.defaultValue ?? false);
    } else {
      values[field.key] = typeof value === "string" ? value : "";
    }
  }
  return values;
}

export function siteIntegrationSettingsFromValues(
  provider: SiteIntegrationProvider,
  values: SiteIntegrationValues,
  current: Record<string, unknown> | null = null
): Record<string, unknown> {
  const fieldKeys = new Set<string>(provider.fields.map((field) => field.key));
  const settings: Record<string, unknown> = Object.fromEntries(
    Object.entries(current ?? {}).filter(([key]) => !fieldKeys.has(key))
  );
  for (const field of provider.fields) {
    const raw = values[field.key];
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (typeof value === "boolean" || value) {
      settings[field.key] = value;
    }
  }
  return settings;
}

export function siteIntegrationUpdateFromValues(
  provider: SiteIntegrationProvider,
  values: SiteIntegrationValues,
  current: Record<string, unknown> | null = null
) {
  const result = siteIntegrationUpdateSchema.safeParse({
    provider: provider.id,
    settings: siteIntegrationSettingsFromValues(provider, values, current),
  });
  return result.success ? result.data : null;
}

export function siteIntegrationFieldErrors(
  provider: SiteIntegrationProvider,
  settings: Record<string, unknown>
): Record<string, string> {
  const result = siteIntegrationSchemas[provider.id].safeParse(settings);
  const errors: Record<string, string> = {};
  if (result.success) {
    return errors;
  }
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

export function siteIntegrationExampleSettings(
  provider: SiteIntegrationProvider,
  settings: Record<string, unknown>
): Record<string, unknown> {
  const requiredFields = provider.fields.filter(
    (field) => !field.optional && field.type !== "boolean"
  );
  return {
    ...Object.fromEntries(requiredFields.map((field) => [field.key, ""])),
    ...settings,
  };
}
