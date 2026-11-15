export function formatCompactNumber(
  value: number,
  locale: string,
  maximumFractionDigits?: number
): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits,
  }).format(value);
}
