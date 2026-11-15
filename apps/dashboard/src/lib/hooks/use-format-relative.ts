import { formatRelative } from "@notra/utils/format-relative";
import { useLocale, useTranslations } from "use-intl";

export function useFormatRelative() {
  const locale = useLocale();
  const t = useTranslations("common.time");
  const justNow = t("justNow");
  return (iso: string, now?: number) =>
    formatRelative(iso, locale, justNow, now);
}
