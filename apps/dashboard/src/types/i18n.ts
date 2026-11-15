import type { DASHBOARD_LOCALES } from "@notra/schemas/constants/dashboard/locales";
import type { useTranslations } from "use-intl";
export type DashboardLocale = (typeof DASHBOARD_LOCALES)[number];

export interface DashboardLocaleOption {
  value: DashboardLocale;
  label: string;
  flag: string;
}

export type CommonTranslator = ReturnType<typeof useTranslations<"common">>;
export type LocalePreference = DashboardLocale | null;
