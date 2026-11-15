import type { DiffSectionProps } from "@/types/skills";

export function DiffSection({ label, children }: DiffSectionProps) {
  return (
    <section>
      <h3 className="bg-muted/40 text-muted-foreground border-b px-3 py-1.5 text-xs font-medium">
        {label}
      </h3>
      <div className="py-1">{children}</div>
    </section>
  );
}
