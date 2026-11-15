import type { GeoReportSectionProps } from "@/types/geo-report";

export function ReportSection({
  id,
  title,
  lede,
  children,
}: GeoReportSectionProps) {
  return (
    <section
      className="geo-section border-t border-(--geo-line) px-6 py-12 sm:px-14 sm:py-16"
      id={`geo-${id}`}
    >
      <h2 className="text-2xl font-semibold tracking-[-0.02em] text-balance">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-(--geo-muted)">{lede}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
